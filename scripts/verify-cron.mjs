// HIGH-1 — expired-reservation cleanup cron route verification.
//
// Prereqs:
//   1. CRON_SECRET in .env.local
//   2. The dev server running with that env var: npm run dev
//
// Run:  node --env-file=.env.local scripts/verify-cron.mjs
//
// Seeds a reservation whose expires_at is already in the past, then checks
// the route rejects unauthenticated/wrong-secret calls and, with the right
// secret, actually releases it (stock reservation -> released, order ->
// cancelled). Self-cleaning.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const ROUTE_URL = `${BASE}/api/cron/release-expired-reservations`;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
  ["CRON_SECRET", CRON_SECRET],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Missing in .env.local: " + missing.join(", "));
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];
const pass = (n, d = "") => results.push({ ok: true, n, d });
const fail = (n, d = "") => results.push({ ok: false, n, d });

const TAG = `zzz-cron-${Date.now()}`;
const ids = {};

async function seedExpiredHold() {
  const { data: cat } = await admin.from("categories").insert({ slug: TAG, name: "Cron Verify" }).select("id").single();
  ids.category = cat.id;
  const { data: prod } = await admin.from("products").insert({ slug: TAG, name: "Cron Verify", category_id: cat.id, base_price: 500 }).select("id").single();
  ids.product = prod.id;
  const { data: v } = await admin.from("product_variants").insert({ product_id: prod.id, size: "M", sku: `${TAG}-M`, price: 500, stock_qty: 5 }).select("id").single();
  ids.variant = v.id;

  const { data: o } = await admin.from("orders").insert({
    status: "pending_payment", payment_status: "created",
    shipping_name: "Cron Verify", shipping_phone: "9000000002",
    shipping_address_line1: "1 Cron St", shipping_city: "Chennai",
    shipping_state: "TN", shipping_pincode: "600001",
    subtotal: 500, total: 500,
  }).select("id, order_number").single();
  ids.order = o.id;

  await admin.from("order_items").insert({
    order_id: o.id, variant_id: ids.variant, product_name_snapshot: "Cron Verify",
    size_snapshot: "M", unit_price: 500, quantity: 1,
  });

  // Insert an already-expired 'held' reservation directly (bypassing
  // reserve_stock's now()+15min default) to simulate an abandoned checkout.
  const { data: r } = await admin.from("inventory_reservations").insert({
    order_id: o.id, variant_id: ids.variant, quantity: 1, status: "held",
    expires_at: new Date(Date.now() - 60_000).toISOString(), // 1 minute in the past
  }).select("id").single();
  ids.reservation = r.id;

  return o;
}

async function callRoute(authHeader) {
  const res = await fetch(ROUTE_URL, {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function reservationStatus(id) {
  const { data } = await admin.from("inventory_reservations").select("status").eq("id", id).single();
  return data?.status;
}
async function orderStatus(id) {
  const { data } = await admin.from("orders").select("status").eq("id", id).single();
  return data?.status;
}

async function main() {
  const noAuth = await callRoute(null);
  if (noAuth.status === 401) pass("No auth header", "401 rejected");
  else fail("No auth header", `expected 401, got ${noAuth.status}`);

  const wrongAuth = await callRoute("Bearer wrong-secret");
  if (wrongAuth.status === 401) pass("Wrong secret", "401 rejected");
  else fail("Wrong secret", `expected 401, got ${wrongAuth.status}`);

  await seedExpiredHold();

  const before = await reservationStatus(ids.reservation);
  if (before === "held") pass("Seed", "expired hold created with status='held'");
  else fail("Seed", `expected 'held', got ${before}`);

  const ok = await callRoute(`Bearer ${CRON_SECRET}`);
  if (ok.status !== 200) {
    fail("Correct secret", `expected 200, got ${ok.status} ${JSON.stringify(ok.body)}`);
  } else {
    pass("Correct secret", `200, released=${ok.body?.released}`);
  }

  const afterRes = await reservationStatus(ids.reservation);
  const afterOrder = await orderStatus(ids.order);
  if (afterRes === "released" && afterOrder === "cancelled")
    pass("Sweep effect", "reservation released, order cancelled");
  else fail("Sweep effect", `reservation=${afterRes}, order=${afterOrder}`);

  // Idempotency: calling again should not error and should not double-count
  // this already-released reservation.
  const again = await callRoute(`Bearer ${CRON_SECRET}`);
  if (again.status === 200) pass("Re-run", "200, no error on empty sweep");
  else fail("Re-run", `expected 200, got ${again.status}`);
}

async function cleanup() {
  if (ids.order) {
    await admin.from("inventory_movements").delete().eq("order_id", ids.order);
    await admin.from("inventory_reservations").delete().eq("order_id", ids.order);
    await admin.from("order_items").delete().eq("order_id", ids.order);
    await admin.from("orders").delete().eq("id", ids.order);
  }
  if (ids.variant) {
    await admin.from("inventory_movements").delete().eq("variant_id", ids.variant);
    await admin.from("inventory_reservations").delete().eq("variant_id", ids.variant);
    await admin.from("product_variants").delete().eq("id", ids.variant);
  }
  if (ids.product) await admin.from("products").delete().eq("id", ids.product);
  if (ids.category) await admin.from("categories").delete().eq("id", ids.category);
}

function report() {
  console.log("\n  Velmaya — Expired-reservation cleanup cron verification\n  " + "─".repeat(46));
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
