import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderConfirmationEmails } from "@/lib/email/order-emails";

// Single, idempotent place where a paid/failed payment finalizes an order.
// Both the browser success callback (confirmPayment) and the Razorpay webhook
// call these — whichever arrives first wins, the second is a no-op. This is what
// makes "webhook + client callback" safe: stock is never double-confirmed and an
// order never flips back out of a terminal state.

type DB = SupabaseClient;

export type FinalizeResult =
  | { status: "finalized" }
  | { status: "already" }
  | { status: "not_found" }
  | { status: "error"; message: string };

// Payment captured → confirm reservations, mark order paid. Idempotent: if the
// order is already paid, do nothing.
export async function finalizeOrderPaid(
  db: DB,
  args: { orderId: string; razorpayPaymentId: string; method?: string }
): Promise<FinalizeResult> {
  const { data: order, error } = await db
    .from("orders")
    .select("id, status")
    .eq("id", args.orderId)
    .single();

  if (error || !order) return { status: "not_found" };
  if (order.status === "paid") return { status: "already" };
  if (order.status === "cancelled" || order.status === "refunded") {
    return { status: "error", message: `order is ${order.status}` };
  }

  // Confirm held reservations (held → confirmed, stock decremented, SALE ledger).
  const { error: confirmErr } = await db.rpc("confirm_reservations", {
    p_order_id: args.orderId,
  });
  if (confirmErr) return { status: "error", message: confirmErr.message };

  const { error: updErr } = await db
    .from("orders")
    .update({
      status: "paid",
      payment_status: "captured",
      razorpay_payment_id: args.razorpayPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.orderId);
  if (updErr) return { status: "error", message: updErr.message };

  await db
    .from("payment_attempts")
    .update({
      status: "captured",
      razorpay_payment_id: args.razorpayPaymentId,
      method: args.method ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", args.orderId)
    .eq("status", "created");

  // Order confirmation email — finalizeOrderPaid is the single source of
  // truth for this, so it fires regardless of whether the webhook or the
  // browser callback won the race, exactly once (see order-emails.ts). A
  // failed send is logged, never surfaced — payment finalization has already
  // succeeded by this point and must not be undone by an email problem.
  try {
    await sendOrderConfirmationEmails(db, args.orderId);
  } catch (err) {
    console.error("finalizeOrderPaid: email dispatch threw unexpectedly", args.orderId, err);
  }

  return { status: "finalized" };
}

// Payment failed → release reservations, mark order failed. Idempotent and
// never overrides a captured order (a late failure event can't undo a success).
export async function failOrderPayment(
  db: DB,
  args: {
    orderId: string;
    razorpayPaymentId?: string;
    errorCode?: string;
    errorDescription?: string;
  }
): Promise<FinalizeResult> {
  const { data: order, error } = await db
    .from("orders")
    .select("id, status")
    .eq("id", args.orderId)
    .single();

  if (error || !order) return { status: "not_found" };
  if (order.status === "paid") return { status: "already" }; // capture won
  if (order.status === "payment_failed" || order.status === "cancelled") {
    return { status: "already" };
  }

  const { error: relErr } = await db.rpc("release_reservations", {
    p_order_id: args.orderId,
  });
  if (relErr) return { status: "error", message: relErr.message };

  await db
    .from("orders")
    .update({
      status: "payment_failed",
      payment_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.orderId);

  await db
    .from("payment_attempts")
    .update({
      status: "failed",
      razorpay_payment_id: args.razorpayPaymentId ?? null,
      error_code: args.errorCode ?? null,
      error_description: args.errorDescription ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", args.orderId)
    .eq("status", "created");

  return { status: "finalized" };
}
