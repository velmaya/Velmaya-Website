// Stage 3 — Razorpay (test mode) integration verification.
//
// Prereqs:
//   1. Razorpay TEST keys + webhook secret in .env.local
//      (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET)
//   2. The dev server running with those env vars:  npm run dev
//   3. Supabase configured + migrations applied (Stage 2.5 green)
//
// Run:  node --env-file=.env.local scripts/verify-razorpay.mjs
//
// It exercises the REAL webhook route over HTTP (signature verification,
// idempotency, finalize/release), plus live test-mode order creation, against
// temporary data it seeds and then deletes. Nothing is left behind.

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const WEBHOOK_URL = `${BASE}/api/webhooks/razorpay`;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
  ["RAZORPAY_KEY_ID", KEY_ID],
  ["RAZORPAY_KEY_SECRET", KEY_SECRET],
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

const TAG = `zzz-rzp-${Date.now()}`;
const ids = {};

function sign(raw) {
  return createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
}
async function postWebhook(payload, signature) {
  const raw = JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature ?? sign(raw),
    },
    body: raw,
  });
  return res.status;
}
async function stockOf(v) {
  const { data } = await admin.from("product_variants").select("stock_qty").eq("id", v).single();
  return data?.stock_qty;
}
async function orderState(id) {
  const { data } = await admin.from("orders").select("status, payment_status").eq("id", id).single();
  return data;
}
async function resStatus(orderId) {
  const { data } = await admin.from("inventory_reservations").select("status").eq("order_id", orderId).limit(1);
  return data?.[0]?.status;
}

async function seedVariant(stock = 5) {
  const { data: cat } = await admin.from("categories").insert({ slug: TAG, name: "RZP Verify" }).select("id").single();
  ids.category = cat.id;
  const { data: prod } = await admin.from("products").insert({ slug: TAG, name: "RZP Verify", category_id: cat.id, base_price: 100 }).select("id").single();
  ids.product = prod.id;
  const { data: v } = await admin.from("product_variants").insert({ product_id: prod.id, size: "M", sku: `${TAG}-M`, price: 100, stock_qty: stock }).select("id").single();
  ids.variant = v.id;
  return v.id;
}
async function seedOrder(variantId, qty, rzpOrderId) {
  const { data: o } = await admin.from("orders").insert({
    status: "pending_payment", payment_status: "created",
    shipping_name: "RZP", shipping_phone: "9000000000",
    shipping_address_line1: "1 St", shipping_city: "Chennai",
    shipping_state: "TN", shipping_pincode: "600001",
    subtotal: 100 * qty, total: 100 * qty, razorpay_order_id: rzpOrderId,
  }).select("id, order_number").single();
  await admin.from("order_items").insert({
    order_id: o.id, variant_id: variantId, product_name_snapshot: "RZP Verify",
    size_snapshot: "M", unit_price: 100, quantity: qty,
  });
  await admin.from("payment_attempts").insert({ order_id: o.id, razorpay_order_id: rzpOrderId, amount: 100 * qty, status: "created" });
  await admin.rpc("reserve_stock", { p_order_id: o.id, p_items: [{ variant_id: variantId, qty }] });
  return o;
}

async function main() {
  // 1. Live test-mode order creation
  let realOrderId;
  {
    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({ amount: 10000, currency: "INR", receipt: TAG }),
    });
    if (!res.ok) { fail("Razorpay order create", `${res.status} ${await res.text()}`); return; }
    const o = await res.json();
    realOrderId = o.id;
    if (KEY_ID.startsWith("rzp_test_")) pass("Test-mode keys", "key id is rzp_test_*");
    else fail("Test-mode keys", `key id is NOT rzp_test_* (got ${KEY_ID.slice(0, 9)}…) — refusing live mode`);
    pass("Razorpay order create", `created ${realOrderId}`);
  }

  // 2. Webhook reachable?
  {
    const status = await postWebhook({ event: "ping" }, "deadbeef");
    if (status === 400) pass("Webhook signature rejection", "bad signature → 400");
    else fail("Webhook signature rejection", `expected 400, got ${status} (is dev server running with the webhook secret?)`);
  }

  // 3. payment.captured → finalize
  const variant = await seedVariant(5);
  {
    const order = await seedOrder(variant, 2, realOrderId);
    ids.order1 = order.id;
    const payload = { event: "payment.captured", id: `${TAG}-evt-cap`, payload: { payment: { entity: { id: `pay_${TAG}`, order_id: realOrderId, method: "upi" } } } };
    const status = await postWebhook(payload);
    const st = await orderState(order.id);
    const stock = await stockOf(variant);
    if (status === 200 && st.status === "paid" && st.payment_status === "captured" && (await resStatus(order.id)) === "confirmed" && stock === 3)
      pass("Webhook payment.captured", "order paid + captured, reservation confirmed, stock 5→3");
    else fail("Webhook payment.captured", `http=${status}, order=${JSON.stringify(st)}, stock=${stock}`);

    // 4. idempotency — replay same event
    const status2 = await postWebhook(payload);
    const stock2 = await stockOf(variant);
    if (status2 === 200 && stock2 === 3) pass("Webhook idempotency", "duplicate event → no double-confirm, stock stays 3");
    else fail("Webhook idempotency", `http=${status2}, stock=${stock2}`);
  }

  // 5. payment.failed → release
  {
    const failRzpId = `order_${TAG}_fail`;
    const order = await seedOrder(variant, 1, failRzpId);
    ids.order2 = order.id;
    const stockBefore = await stockOf(variant); // 3, with 1 now held → physical still 3
    const payload = { event: "payment.failed", id: `${TAG}-evt-fail`, payload: { payment: { entity: { id: `pay_${TAG}_f`, order_id: failRzpId, error_code: "BAD_REQUEST_ERROR", error_description: "test decline" } } } };
    const status = await postWebhook(payload);
    const st = await orderState(order.id);
    const stockAfter = await stockOf(variant);
    if (status === 200 && st.status === "payment_failed" && st.payment_status === "failed" && (await resStatus(order.id)) === "released" && stockAfter === stockBefore)
      pass("Webhook payment.failed", "order failed, reservation released, stock unchanged");
    else fail("Webhook payment.failed", `http=${status}, order=${JSON.stringify(st)}, stockBefore=${stockBefore}, stockAfter=${stockAfter}`);
  }
}

async function cleanup() {
  for (const o of [ids.order1, ids.order2].filter(Boolean)) {
    await admin.from("webhook_events").delete().eq("order_id", o);
    await admin.from("payment_attempts").delete().eq("order_id", o);
    await admin.from("inventory_movements").delete().eq("order_id", o);
    await admin.from("inventory_reservations").delete().eq("order_id", o);
    await admin.from("order_items").delete().eq("order_id", o);
    await admin.from("orders").delete().eq("id", o);
  }
  await admin.from("webhook_events").delete().like("event_id", `${TAG}%`);
  if (ids.variant) {
    await admin.from("inventory_movements").delete().eq("variant_id", ids.variant);
    await admin.from("inventory_reservations").delete().eq("variant_id", ids.variant);
    await admin.from("product_variants").delete().eq("id", ids.variant);
  }
  if (ids.product) await admin.from("products").delete().eq("id", ids.product);
  if (ids.category) await admin.from("categories").delete().eq("id", ids.category);
}

function report() {
  console.log("\n  Velmaya — Razorpay (test mode) verification\n  " + "─".repeat(46));
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
