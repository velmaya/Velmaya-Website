import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resendConfigured, sendEmail } from "./client";
import { customerConfirmationEmail } from "./templates/customer-confirmation";
import { internalNotificationEmail } from "./templates/internal-notification";
import type { OrderEmailData } from "./types";

type DB = SupabaseClient;

// Atomically claims the right to send this order's emails exactly once, even
// if the webhook and the browser callback both call finalizeOrderPaid around
// the same moment. Only the caller that flips confirmation_email_sent_at from
// null actually sends; the other finds zero rows matched and skips.
async function claimEmailSend(db: DB, orderId: string): Promise<boolean> {
  const { data, error } = await db
    .from("orders")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("confirmation_email_sent_at", null)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

async function loadOrderEmailData(db: DB, orderId: string): Promise<OrderEmailData | null> {
  const { data: order } = await db
    .from("orders")
    .select("*, customer:customers(email)")
    .eq("id", orderId)
    .single();
  if (!order) return null;

  const { data: items } = await db
    .from("order_items")
    .select("product_name_snapshot, size_snapshot, unit_price, quantity")
    .eq("order_id", orderId);

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;

  return {
    orderNumber: order.order_number,
    createdAt: order.created_at,
    customerEmail: customer?.email ?? null,
    shippingName: order.shipping_name,
    shippingPhone: order.shipping_phone,
    shippingAddressLine1: order.shipping_address_line1,
    shippingAddressLine2: order.shipping_address_line2,
    shippingCity: order.shipping_city,
    shippingState: order.shipping_state,
    shippingPincode: order.shipping_pincode,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shipping_fee),
    total: Number(order.total),
    orderNotes: order.order_notes,
    giftMessage: order.gift_message,
    items: (items ?? []).map((i) => ({
      productName: i.product_name_snapshot,
      size: i.size_snapshot,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
    })),
  };
}

// Sends the customer confirmation + internal notification for a just-paid
// order. Idempotent (atomically claims confirmation_email_sent_at) and never
// throws — a failed send is logged, not propagated, so it can never block
// payment finalization. Call only from finalizeOrderPaid, on the transition
// to paid — never from the browser directly.
export async function sendOrderConfirmationEmails(db: DB, orderId: string) {
  if (!resendConfigured()) {
    console.warn("sendOrderConfirmationEmails: Resend not configured, skipping", orderId);
    return;
  }

  const claimed = await claimEmailSend(db, orderId);
  if (!claimed) return; // another caller already sent (or is sending)

  try {
    const order = await loadOrderEmailData(db, orderId);
    if (!order) {
      console.error("sendOrderConfirmationEmails: order not found", orderId);
      return;
    }

    const notifyEmail = process.env.SHOP_NOTIFICATION_EMAIL;

    if (order.customerEmail) {
      try {
        await sendEmail({ to: order.customerEmail, ...customerConfirmationEmail(order) });
      } catch (err) {
        console.error("sendOrderConfirmationEmails: customer email failed", orderId, err);
      }
    }

    if (notifyEmail) {
      try {
        await sendEmail({ to: notifyEmail, ...internalNotificationEmail(order) });
      } catch (err) {
        console.error("sendOrderConfirmationEmails: internal notification failed", orderId, err);
      }
    }
  } catch (err) {
    console.error("sendOrderConfirmationEmails: unexpected error", orderId, err);
  }
}
