// reconcile:payments — compare DB order/payment state against Razorpay's record
// of truth. Read-only recovery/debugging tool: it reports mismatches and
// suggested actions but changes nothing.
//
//   node --env-file=.env.local scripts/reconcile-payments.mjs
//
// Use after an incident (missed webhook, stuck order) to see which orders the DB
// and Razorpay disagree about. Needs Razorpay keys to query the gateway.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!URL || !SERVICE) {
  console.error("Missing Supabase env (.env.local).");
  process.exit(2);
}
if (!KEY_ID || !KEY_SECRET) {
  console.error(
    "Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET — cannot reconcile against the gateway."
  );
  process.exit(2);
}

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const auth = "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

// What the DB status SHOULD be, given Razorpay's payments for an order.
function expectedFromPayments(payments) {
  if (payments.some((p) => p.status === "captured")) return "paid";
  if (payments.length && payments.every((p) => p.status === "failed"))
    return "payment_failed";
  return "pending_payment"; // created/authorized/none → still open
}

async function razorpayPayments(razorpayOrderId) {
  const res = await fetch(
    `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
    { headers: { authorization: auth } }
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.items ?? [];
}

async function main() {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const { data: orders, error } = await db
    .from("orders")
    .select("id, order_number, status, payment_status, razorpay_order_id, razorpay_payment_id, created_at")
    .not("razorpay_order_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  console.log(`\n  reconcile:payments — ${orders.length} order(s) with a Razorpay order, last 30 days\n  ${"─".repeat(60)}`);

  let mismatches = 0;
  for (const o of orders) {
    let payments;
    try {
      payments = await razorpayPayments(o.razorpay_order_id);
    } catch (e) {
      console.log(`  ⚠ ${o.order_number}  could not fetch from Razorpay — ${e.message}`);
      continue;
    }
    const expected = expectedFromPayments(payments);
    const captured = payments.find((p) => p.status === "captured");

    if (expected !== o.status) {
      mismatches++;
      console.log(
        `  ✗ ${o.order_number}  DB=${o.status}/${o.payment_status}  Razorpay→${expected}` +
          (captured ? `  (captured ${captured.id})` : "")
      );
      if (expected === "paid")
        console.log(`      action: finalize — confirm reservations + mark paid (replay webhook or POST payment.captured)`);
      else if (expected === "payment_failed")
        console.log(`      action: release reservations + mark payment_failed`);
    }
  }

  console.log("  " + "─".repeat(60));
  console.log(
    mismatches === 0
      ? "  ✓ all reconciled — DB matches Razorpay"
      : `  ${mismatches} mismatch(es) need attention`
  );
  return mismatches;
}

main()
  .then((m) => process.exit(m > 0 ? 1 : 0))
  .catch((e) => {
    console.error("reconcile failed:", e.message);
    process.exit(1);
  });
