"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRazorpayOrder } from "@/lib/razorpay/client";
import { verifyRazorpaySignature } from "@/lib/razorpay/verify";
import { finalizeOrderPaid } from "@/lib/orders/finalize";
import type { CartItem } from "@/lib/cart/types";
import { repriceCart } from "./reprice";
import {
  validateShipping,
  type ShippingValues,
  type RepricedCart,
  type ShippingErrors,
} from "./schema";

function supabaseConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function razorpayConfigured() {
  return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
}

// Authoritative summary for the checkout page — recomputed server-side.
export async function prepareCheckout(
  items: CartItem[]
): Promise<RepricedCart> {
  return repriceCart(items);
}

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      razorpayOrderId: string;
      amountPaise: number;
    }
  | { ok: false; reason: "invalid"; errors: ShippingErrors }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "stock_changed"; cart: RepricedCart }
  | { ok: false; reason: "checkout_unavailable" }
  | { ok: false; reason: "error"; message: string };

// Creates the order in `pending_payment`, reserves stock, opens a Razorpay
// order, and returns the handoff so the client can launch Razorpay Checkout.
// Fulfillment is finalized later by the verified webhook (and the browser
// callback) — see confirmPayment + the webhook route.
export async function placeOrder(payload: {
  items: CartItem[];
  shipping: ShippingValues;
}): Promise<PlaceOrderResult> {
  const { items, shipping } = payload;

  if (!items.length) return { ok: false, reason: "empty" };

  const errors = validateShipping(shipping);
  if (Object.keys(errors).length > 0)
    return { ok: false, reason: "invalid", errors };

  // Authoritative reprice + availability check (never trust the client).
  const cart = await repriceCart(items);
  if (!cart.hasPurchasable || cart.hasChanges)
    return { ok: false, reason: "stock_changed", cart };

  // Online checkout needs both Supabase and Razorpay configured; otherwise fall
  // back gracefully to the WhatsApp order flow (no orphan order is created).
  if (!supabaseConfigured() || !razorpayConfigured())
    return { ok: false, reason: "checkout_unavailable" };

  try {
    const supabase = createSupabaseServerClient();

    // 1. Upsert customer by phone.
    const { data: customer } = await supabase
      .from("customers")
      .upsert(
        {
          phone: shipping.phone.trim(),
          email: shipping.email.trim() || null,
          name: shipping.fullName.trim(),
        },
        { onConflict: "phone" }
      )
      .select("id")
      .single();

    // 2. Checkout session snapshot.
    const { data: session } = await supabase
      .from("checkout_sessions")
      .insert({
        email: shipping.email.trim() || null,
        phone: shipping.phone.trim(),
        cart_snapshot: cart.lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          price: l.unitPrice,
        })),
      })
      .select("id")
      .single();

    // 3. Order (order_number filled by sequence default).
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customer?.id ?? null,
        checkout_session_id: session?.id ?? null,
        status: "pending_payment",
        payment_status: "created",
        shipping_name: shipping.fullName.trim(),
        shipping_phone: shipping.phone.trim(),
        shipping_address_line1: shipping.addressLine1.trim(),
        shipping_address_line2: shipping.addressLine2.trim() || null,
        shipping_city: shipping.city.trim(),
        shipping_state: shipping.state.trim(),
        shipping_pincode: shipping.pincode.trim(),
        subtotal: cart.subtotal,
        shipping_fee: cart.shippingFee,
        total: cart.total,
        order_notes: shipping.orderNotes.trim() || null,
        gift_message: shipping.giftMessage.trim() || null,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) throw orderErr ?? new Error("order insert failed");

    // 4. Order items (price/name/size snapshots).
    const { error: itemsErr } = await supabase.from("order_items").insert(
      cart.lines.map((l) => ({
        order_id: order.id,
        variant_id: l.variantId,
        product_name_snapshot: l.productName,
        size_snapshot: l.size,
        unit_price: l.unitPrice,
        quantity: l.qty,
      }))
    );
    if (itemsErr) throw itemsErr;

    // 5. Reserve stock atomically (raises on insufficient availability).
    const { error: reserveErr } = await supabase.rpc("reserve_stock", {
      p_order_id: order.id,
      p_items: cart.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    });

    if (reserveErr) {
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      return { ok: false, reason: "stock_changed", cart };
    }

    // 6. Open a Razorpay order for the authoritative total (in paise). On
    // failure, release the hold and cancel so no stock is stranded.
    let rzp;
    try {
      rzp = await createRazorpayOrder({
        amountPaise: Math.round(cart.total * 100),
        receipt: order.order_number,
      });
    } catch {
      await supabase.rpc("release_reservations", { p_order_id: order.id });
      await supabase
        .from("orders")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", order.id);
      return {
        ok: false,
        reason: "error",
        message: "Could not start payment. Please try again.",
      };
    }

    await supabase
      .from("orders")
      .update({ razorpay_order_id: rzp.id })
      .eq("id", order.id);
    await supabase.from("payment_attempts").insert({
      order_id: order.id,
      razorpay_order_id: rzp.id,
      amount: cart.total,
      status: "created",
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      razorpayOrderId: rzp.id,
      amountPaise: rzp.amount,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }
}

export type ConfirmPaymentResult =
  | { ok: true; orderNumber: string }
  | { ok: false; message: string };

// Browser success callback from Razorpay Checkout. Verifies the signature and
// finalizes the order. This is a UX convenience — the webhook is the
// authoritative finalizer, and finalizeOrderPaid is idempotent, so whichever
// arrives first wins and the other is a no-op.
export async function confirmPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<ConfirmPaymentResult> {
  const valid = verifyRazorpaySignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.signature,
  });
  if (!valid) return { ok: false, message: "Payment could not be verified." };

  const supabase = createSupabaseServerClient();
  const result = await finalizeOrderPaid(supabase, {
    orderId: input.orderId,
    razorpayPaymentId: input.razorpayPaymentId,
  });

  if (result.status === "error" || result.status === "not_found")
    return { ok: false, message: "We couldn't confirm your order. Our team will reach out." };

  const { data } = await supabase
    .from("orders")
    .select("order_number")
    .eq("id", input.orderId)
    .single();

  return { ok: true, orderNumber: data?.order_number ?? "" };
}
