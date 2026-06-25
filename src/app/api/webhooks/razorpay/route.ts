import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/razorpay/verify";
import { finalizeOrderPaid, failOrderPayment } from "@/lib/orders/finalize";

// Authoritative payment finalizer. Razorpay POSTs events here; this route is the
// source of truth for fulfillment (the browser callback is only a UX shortcut).
//
// Must run on the Node runtime (HMAC via node:crypto) and read the RAW body —
// re-serialising would change the bytes and break signature verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature({ rawBody, signature })) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Idempotency: the event id is the primary key of webhook_events. A duplicate
  // delivery (Razorpay retries) conflicts and is skipped.
  const eventId = eventIdOf(event, rawBody);
  const { error: dupErr } = await supabase.from("webhook_events").insert({
    event_id: eventId,
    type: event.event,
    payload: event,
  });
  if (dupErr) {
    // Unique violation → already processed. Ack so Razorpay stops retrying.
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  // Map Razorpay order id → our order.
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("razorpay_order_id", payment.order_id)
    .single();

  if (!order) {
    // Unknown order — ack to avoid retry storms; flag for investigation.
    console.warn("razorpay webhook for unknown order", payment.order_id);
    await supabase
      .from("webhook_events")
      .update({ order_id: null })
      .eq("event_id", eventId);
    return NextResponse.json({ status: "unknown_order" }, { status: 200 });
  }

  await supabase
    .from("webhook_events")
    .update({ order_id: order.id })
    .eq("event_id", eventId);

  if (event.event === "payment.captured" || event.event === "order.paid") {
    await finalizeOrderPaid(supabase, {
      orderId: order.id,
      razorpayPaymentId: payment.id,
      method: payment.method,
    });
  } else if (event.event === "payment.failed") {
    await failOrderPayment(supabase, {
      orderId: order.id,
      razorpayPaymentId: payment.id,
      errorCode: payment.error_code ?? undefined,
      errorDescription: payment.error_description ?? undefined,
    });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

function eventIdOf(event: RazorpayEvent, rawBody: string) {
  // Razorpay sends `x-razorpay-event-id`, but the body also carries enough to
  // dedupe; prefer an explicit id, else hash the payment id + event type.
  return (
    event.id ??
    `${event.event}:${event.payload?.payment?.entity?.id ?? rawBody.length}`
  );
}

type RazorpayEvent = {
  id?: string;
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id?: string;
        method?: string;
        error_code?: string | null;
        error_description?: string | null;
      };
    };
  };
};
