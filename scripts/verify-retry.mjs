// HIGH-2 — payment-retry duplicate-reservation fix verification.
//
// placeOrder's previousOrderId path (src/lib/checkout/actions.ts,
// releaseIfStillPending) can't be invoked directly from a plain Node script
// (it's a "use server" action — same reason verify-razorpay.mjs/verify-
// email.mjs test the webhook ROUTE rather than confirmPayment directly).
// This exercises the exact Supabase sequence that path performs, to prove:
//   1. Releasing order A's hold before creating order B lets B's reserve
//      succeed for stock that would otherwise still look "held".
//   2. Only order B ends up with an active (held) reservation.
//   3. The phone-mismatch guard refuses to release a reservation that
//      doesn't belong to the retrying shopper.
//
// Run:  node --env-file=.env.local scripts/verify-retry.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Missing in .env.local: " + missing.join(", "));
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];
const pass = (n, d = "") => results.push({ ok: true, n, d });
const fail = (n, d = "") => results.push({ ok: false, n, d });

const TAG = `zzz-retry-${Date.now()}`;
const ids = {};
const PHONE = "9000000003";
const OTHER_PHONE = "9000000004";

async function stockOf(v) {
  const { data } = await admin.from("product_variants").select("stock_qty").eq("id", v).single();
  return data?.stock_qty;
}
async function reservationStatus(id) {
  const { data } = await admin.from("inventory_reservations").select("status").eq("id", id).single();
  return data?.status;
}
async function orderStatus(id) {
  const { data } = await admin.from("orders").select("status").eq("id", id).single();
  return data?.status;
}

// Mirrors releaseIfStillPending() in src/lib/checkout/actions.ts exactly.
async function releaseIfStillPending(orderId, phone) {
  const { data: order } = await admin
    .from("orders")
    .select("id, status, shipping_phone")
    .eq("id", orderId)
    .single();
  if (!order || order.status !== "pending_payment") return;
  if (order.shipping_phone !== phone) return;
  await admin.rpc("release_reservations", { p_order_id: order.id });
  await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
}

async function seedVariant(stock) {
  const { data: cat } = await admin.from("categories").insert({ slug: TAG, name: "Retry Verify" }).select("id").single();
  ids.category = cat.id;
  const { data: prod } = await admin.from("products").insert({ slug: TAG, name: "Retry Verify", category_id: cat.id, base_price: 100 }).select("id").single();
  ids.product = prod.id;
  const { data: v } = await admin.from("product_variants").insert({ product_id: prod.id, size: "M", sku: `${TAG}-M`, price: 100, stock_qty: stock }).select("id").single();
  ids.variant = v.id;
  return v.id;
}

async function createPendingOrder(variantId, qty, phone) {
  const { data: o } = await admin.from("orders").insert({
    status: "pending_payment", payment_status: "created",
    shipping_name: "Retry Verify", shipping_phone: phone,
    shipping_address_line1: "1 Retry St", shipping_city: "Chennai",
    shipping_state: "TN", shipping_pincode: "600001",
    subtotal: 100 * qty, total: 100 * qty,
  }).select("id, order_number").single();
  await admin.from("order_items").insert({
    order_id: o.id, variant_id: variantId, product_name_snapshot: "Retry Verify",
    size_snapshot: "M", unit_price: 100, quantity: qty,
  });
  const { error } = await admin.rpc("reserve_stock", { p_order_id: o.id, p_items: [{ variant_id: variantId, qty }] });
  const { data: res } = await admin.from("inventory_reservations").select("id, status").eq("order_id", o.id).single();
  return { order: o, reserveError: error, reservationId: res?.id };
}

async function main() {
  // Stock of 3 — tight enough that a duplicate hold would actually collide.
  const variant = await seedVariant(3);

  // Attempt 1: reserve all 3 units.
  const attempt1 = await createPendingOrder(variant, 3, PHONE);
  ids.order1 = attempt1.order.id;
  if (!attempt1.reserveError && (await reservationStatus(attempt1.reservationId)) === "held")
    pass("Attempt 1 reserves stock", `order ${attempt1.order.order_number}, 3 units held`);
  else fail("Attempt 1 reserves stock", `error=${attempt1.reserveError?.message}`);

  // A second reserve attempt WITHOUT releasing attempt 1 first must fail —
  // proves the fix is actually necessary (no fix = this collision happens).
  const { data: sanityOrder } = await admin.from("orders").insert({
    status: "pending_payment", payment_status: "created",
    shipping_name: "Retry Verify", shipping_phone: PHONE,
    shipping_address_line1: "1 Retry St", shipping_city: "Chennai",
    shipping_state: "TN", shipping_pincode: "600001",
    subtotal: 300, total: 300,
  }).select("id").single();
  const sanityReserve = await admin.rpc("reserve_stock", { p_order_id: sanityOrder.id, p_items: [{ variant_id: variant, qty: 3 }] });
  if (sanityReserve.error) pass("Without release, retry collides", "insufficient_stock as expected — confirms the fix is needed");
  else fail("Without release, retry collides", "expected insufficient_stock, but it succeeded — stock model changed?");
  await admin.from("orders").delete().eq("id", sanityOrder.id); // never really held; nothing to release

  // Phone-mismatch guard: a different shopper's id must not release order1.
  await releaseIfStillPending(attempt1.order.id, OTHER_PHONE);
  if ((await reservationStatus(attempt1.reservationId)) === "held")
    pass("Phone mismatch guard", "release refused for a different phone — order1 still held");
  else fail("Phone mismatch guard", "order1 was released despite phone mismatch");

  // Now the real retry path: release with the SAME phone before attempt 2.
  await releaseIfStillPending(attempt1.order.id, PHONE);
  const releasedStatus = await reservationStatus(attempt1.reservationId);
  const order1Status = await orderStatus(attempt1.order.id);
  if (releasedStatus === "released" && order1Status === "cancelled")
    pass("Retry releases prior hold", "reservation released, order1 cancelled");
  else fail("Retry releases prior hold", `reservation=${releasedStatus}, order1=${order1Status}`);

  // Attempt 2 (the retry) should now succeed for the same 3 units.
  const attempt2 = await createPendingOrder(variant, 3, PHONE);
  ids.order2 = attempt2.order.id;
  if (!attempt2.reserveError && (await reservationStatus(attempt2.reservationId)) === "held")
    pass("Retry succeeds, no duplicate hold", `order ${attempt2.order.order_number} reserved the freed stock`);
  else fail("Retry succeeds, no duplicate hold", `error=${attempt2.reserveError?.message}`);

  // Exactly one active (held) reservation should exist for this variant.
  const { data: heldRows } = await admin.from("inventory_reservations").select("id").eq("variant_id", variant).eq("status", "held");
  if ((heldRows ?? []).length === 1) pass("Exactly one active reservation", `${heldRows.length} held row(s) for this variant`);
  else fail("Exactly one active reservation", `expected 1, got ${(heldRows ?? []).length}`);

  const stock = await stockOf(variant);
  if (stock === 3) pass("stock_qty untouched", "holds don't decrement physical stock until confirm");
  else fail("stock_qty untouched", `expected 3, got ${stock}`);
}

async function cleanup() {
  for (const o of [ids.order1, ids.order2].filter(Boolean)) {
    await admin.from("inventory_movements").delete().eq("order_id", o);
    await admin.from("inventory_reservations").delete().eq("order_id", o);
    await admin.from("order_items").delete().eq("order_id", o);
    await admin.from("orders").delete().eq("id", o);
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
  console.log("\n  Velmaya — Payment retry (no duplicate reservation) verification\n  " + "─".repeat(46));
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
