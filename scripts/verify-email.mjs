// Stage 4 — Email notifications verification.
//
// Prereqs:
//   1. RESEND_API_KEY + EMAIL_FROM + SHOP_NOTIFICATION_EMAIL in .env.local
//      (EMAIL_FROM's domain must be verified in the Resend dashboard)
//   2. The dev server running with those env vars:  npm run dev
//   3. Stage 3.6 green (Razorpay webhook verified)
//
// Run:  node --env-file=.env.local scripts/verify-email.mjs [your-email@example.com]
//
// Exercises the REAL webhook route -> finalizeOrderPaid -> sendOrderConfirmationEmails
// against a temporary order it seeds (pass your own email as an argument to
// receive a real customer-confirmation test send), then deletes everything.

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const NOTIFY = process.env.SHOP_NOTIFICATION_EMAIL;
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const WEBHOOK_URL = `${BASE}/api/webhooks/razorpay`;
const TEST_EMAIL = process.argv[2];

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
  ["RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Missing in .env.local: " + missing.join(", "));
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];
const pass = (n, d = "") => results.push({ ok: true, n, d });
const fail = (n, d = "") => results.push({ ok: false, n, d });
const info = (n, d = "") => results.push({ ok: true, n: `${n} (info)`, d });

const TAG = `zzz-email-${Date.now()}`;
const ids = {};

function sign(raw) {
  return createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
}
async function postWebhook(payload) {
  const raw = JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": sign(raw) },
    body: raw,
  });
  return res.status;
}
async function emailSentAt(orderId) {
  const { data } = await admin.from("orders").select("confirmation_email_sent_at").eq("id", orderId).single();
  return data?.confirmation_email_sent_at ?? null;
}

async function seedOrder() {
  const { data: cat } = await admin.from("categories").insert({ slug: TAG, name: "Email Verify" }).select("id").single();
  ids.category = cat.id;
  const { data: prod } = await admin.from("products").insert({ slug: TAG, name: "Email Verify Kurti", category_id: cat.id, base_price: 999 }).select("id").single();
  ids.product = prod.id;
  const { data: v } = await admin.from("product_variants").insert({ product_id: prod.id, size: "M", sku: `${TAG}-M`, price: 999, stock_qty: 5 }).select("id").single();
  ids.variant = v.id;

  let customerId = null;
  if (TEST_EMAIL) {
    const { data: cust } = await admin.from("customers")
      .insert({ phone: `9${Date.now().toString().slice(-9)}`, email: TEST_EMAIL, full_name: "Email Verify" })
      .select("id").single();
    ids.customer = cust.id;
    customerId = cust.id;
  }

  const rzpOrderId = `order_${TAG}`;
  const { data: o } = await admin.from("orders").insert({
    customer_id: customerId,
    status: "pending_payment", payment_status: "created",
    shipping_name: "Email Verify", shipping_phone: "9000000001",
    shipping_address_line1: "1 Verify St", shipping_city: "Chennai",
    shipping_state: "TN", shipping_pincode: "600001",
    subtotal: 999, shipping_fee: 79, total: 1078,
    razorpay_order_id: rzpOrderId,
    gift_message: "Happy verifying!",
  }).select("id, order_number").single();
  ids.order = o.id;

  await admin.from("order_items").insert({
    order_id: o.id, variant_id: ids.variant, product_name_snapshot: "Email Verify Kurti",
    size_snapshot: "M", unit_price: 999, quantity: 1,
  });
  await admin.from("payment_attempts").insert({ order_id: o.id, razorpay_order_id: rzpOrderId, amount: 1078, status: "created" });
  await admin.rpc("reserve_stock", { p_order_id: o.id, p_items: [{ variant_id: ids.variant, qty: 1 }] });

  return o;
}

async function main() {
  if (!RESEND_KEY || !EMAIL_FROM) {
    info("Resend not configured", "RESEND_API_KEY/EMAIL_FROM empty — send path will skip (expected; add both + restart dev to test real delivery)");
  }
  if (!NOTIFY) info("SHOP_NOTIFICATION_EMAIL not set", "internal notification will be skipped");
  if (!TEST_EMAIL) info("No test email passed", "run `node --env-file=.env.local scripts/verify-email.mjs you@example.com` to receive a real customer-confirmation test send");

  const order = await seedOrder();

  const payload = {
    event: "payment.captured",
    id: `${TAG}-evt-cap`,
    payload: { payment: { entity: { id: `pay_${TAG}`, order_id: `order_${TAG}`, method: "card" } } },
  };
  const status = await postWebhook(payload);
  if (status !== 200) {
    fail("Webhook call", `expected 200, got ${status} (is dev server running with RAZORPAY_WEBHOOK_SECRET?)`);
    return;
  }

  const sentAt1 = await emailSentAt(order.id);

  if (RESEND_KEY && EMAIL_FROM) {
    if (sentAt1) pass("Email dispatch claimed + attempted", `confirmation_email_sent_at=${sentAt1}`);
    else fail("Email dispatch claimed + attempted", "confirmation_email_sent_at is still null after a captured payment");
  } else if (!sentAt1) {
    pass("Email skipped gracefully", "Resend not configured — confirmation_email_sent_at correctly left null, payment still finalized");
  } else {
    fail("Unexpected", "confirmation_email_sent_at was set despite Resend not being configured");
  }

  // Idempotency: replay the same webhook event — must not re-claim/re-send.
  const status2 = await postWebhook(payload);
  const sentAt2 = await emailSentAt(order.id);
  if (status2 === 200 && sentAt2 === sentAt1)
    pass("Email idempotency", "duplicate payment.captured → no re-send, timestamp unchanged");
  else fail("Email idempotency", `http=${status2}, sentAt1=${sentAt1}, sentAt2=${sentAt2}`);
}

async function cleanup() {
  if (ids.order) {
    await admin.from("webhook_events").delete().eq("order_id", ids.order);
    await admin.from("payment_attempts").delete().eq("order_id", ids.order);
    await admin.from("inventory_movements").delete().eq("order_id", ids.order);
    await admin.from("inventory_reservations").delete().eq("order_id", ids.order);
    await admin.from("order_items").delete().eq("order_id", ids.order);
    await admin.from("orders").delete().eq("id", ids.order);
  }
  await admin.from("webhook_events").delete().like("event_id", `${TAG}%`);
  if (ids.variant) {
    await admin.from("inventory_movements").delete().eq("variant_id", ids.variant);
    await admin.from("inventory_reservations").delete().eq("variant_id", ids.variant);
    await admin.from("product_variants").delete().eq("id", ids.variant);
  }
  if (ids.product) await admin.from("products").delete().eq("id", ids.product);
  if (ids.category) await admin.from("categories").delete().eq("id", ids.category);
  if (ids.customer) await admin.from("customers").delete().eq("id", ids.customer);
}

function report() {
  console.log("\n  Velmaya — Email notifications verification\n  " + "─".repeat(46));
  for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.n}${r.d ? `  — ${r.d}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log("  " + "─".repeat(46));
  console.log(`  ${results.length - failed}/${results.length} checks passed` + (failed ? `  (${failed} FAILED)` : "  ✓ all green"));
  return failed;
}

let code = 0;
try { await main(); }
catch (e) { fail("Unexpected error", e instanceof Error ? e.message : String(e)); }
finally { try { await cleanup(); } catch { /* best effort */ } code = report() > 0 ? 1 : 0; }
process.exit(code);
