// Stage 3.5 — full-journey verification using REAL catalogue records.
//
//   node --env-file=.env.local scripts/verify-journey.mjs
//
// Picks a real published product variant from Supabase and walks the order +
// inventory journey against it (checkout records → reserve → capture → release),
// asserting each step. It then RESTORES the variant's stock and deletes the
// throwaway order, so the live catalogue is left exactly as it was. The Razorpay
// payment leg (gateway + webhook HTTP) is covered by `npm run verify:razorpay`.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing Supabase env (.env.local).");
  process.exit(2);
}
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const results = [];
const pass = (n, d = "") => results.push({ ok: true, n, d });
const fail = (n, d = "") => results.push({ ok: false, n, d });
const ids = {};
let original = null; // { variantId, slug, size, stock }

async function stockOf(v) {
  const { data } = await db.from("product_variants").select("stock_qty").eq("id", v).single();
  return data?.stock_qty;
}
async function resStatus(orderId) {
  const { data } = await db.from("inventory_reservations").select("status").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.status;
}
async function hasMovement(orderId, reason) {
  const { data } = await db.from("inventory_movements").select("id").eq("order_id", orderId).eq("reason", reason).limit(1);
  return !!data?.length;
}

async function main() {
  // 1. Pick a REAL published variant with stock to spare.
  const { data: variant, error } = await db
    .from("product_variants")
    .select("id, size, sku, price, stock_qty, products!inner(slug, name, is_published)")
    .gte("stock_qty", 2)
    .limit(1)
    .single();
  if (error || !variant) return fail("Real catalogue variant", "no published variant with stock ≥ 2 found — seed the catalogue first");
  original = { variantId: variant.id, slug: variant.products.slug, size: variant.size, stock: variant.stock_qty };
  pass("Real catalogue variant", `${variant.products.slug} (${variant.size}), stock ${variant.stock_qty}`);

  // 2. Checkout records (customer → session → order → items)
  const { data: cust } = await db.from("customers").upsert({ phone: `9${Date.now() % 1000000000}`, name: "Journey Verify" }, { onConflict: "phone" }).select("id").single();
  ids.customer = cust?.id;
  const { data: sess } = await db.from("checkout_sessions").insert({ phone: "9000000000", cart_snapshot: [{ variant_id: variant.id, qty: 2, price: variant.price }] }).select("id").single();
  ids.session = sess?.id;
  const { data: order } = await db.from("orders").insert({
    customer_id: ids.customer, checkout_session_id: ids.session,
    status: "pending_payment", payment_status: "created",
    shipping_name: "Journey Verify", shipping_phone: "9000000000",
    shipping_address_line1: "1 Test St", shipping_city: "Chennai",
    shipping_state: "Tamil Nadu", shipping_pincode: "600001",
    subtotal: variant.price * 2, total: variant.price * 2,
  }).select("id, order_number").single();
  ids.order = order.id;
  await db.from("order_items").insert({ order_id: order.id, variant_id: variant.id, product_name_snapshot: variant.products.name, size_snapshot: variant.size, unit_price: variant.price, quantity: 2 });
  if (/^VLM-\d{6}$/.test(order.order_number)) pass("Checkout records", `order ${order.order_number} + customer + session + items`);
  else fail("Checkout records", `bad order_number ${order.order_number}`);

  // 3. Inventory reservation against the real variant
  const { error: rErr } = await db.rpc("reserve_stock", { p_order_id: order.id, p_items: [{ variant_id: variant.id, qty: 2 }] });
  if (rErr) return fail("Inventory reservation", rErr.message);
  const heldStock = await stockOf(variant.id);
  if ((await resStatus(order.id)) === "held" && heldStock === original.stock && (await hasMovement(order.id, "RESERVATION")))
    pass("Inventory reservation", `held; physical stock unchanged (${heldStock}); RESERVATION logged`);
  else fail("Inventory reservation", `status=${await resStatus(order.id)}, stock=${heldStock}`);

  // 4. Payment capture → confirm (mirrors finalizeOrderPaid's DB effects)
  const { error: cErr } = await db.rpc("confirm_reservations", { p_order_id: order.id });
  if (cErr) return fail("Capture → confirm", cErr.message);
  await db.from("orders").update({ status: "paid", payment_status: "captured" }).eq("id", order.id);
  const soldStock = await stockOf(variant.id);
  if ((await resStatus(order.id)) === "confirmed" && soldStock === original.stock - 2 && (await hasMovement(order.id, "SALE")))
    pass("Capture → confirm", `confirmed; stock ${original.stock}→${soldStock}; SALE logged`);
  else fail("Capture → confirm", `status=${await resStatus(order.id)}, stock=${soldStock}`);

  // 5. Order reaches a terminal paid state
  const { data: finalOrder } = await db.from("orders").select("status, payment_status").eq("id", order.id).single();
  if (finalOrder?.status === "paid" && finalOrder?.payment_status === "captured")
    pass("Order finalized", "status=paid, payment_status=captured");
  else fail("Order finalized", JSON.stringify(finalOrder));
}

async function cleanup() {
  if (ids.order) {
    await db.from("webhook_events").delete().eq("order_id", ids.order);
    await db.from("payment_attempts").delete().eq("order_id", ids.order);
    await db.from("inventory_movements").delete().eq("order_id", ids.order);
    await db.from("inventory_reservations").delete().eq("order_id", ids.order);
    await db.from("order_items").delete().eq("order_id", ids.order);
    await db.from("orders").delete().eq("id", ids.order);
  }
  if (ids.session) await db.from("checkout_sessions").delete().eq("id", ids.session);
  if (ids.customer) await db.from("customers").delete().eq("id", ids.customer);
  // Restore the real variant's stock to exactly what it was.
  if (original) {
    await db.from("product_variants").update({ stock_qty: original.stock }).eq("id", original.variantId);
  }
}

function report() {
  console.log("\n  Velmaya — full-journey verification (real catalogue)\n  " + "─".repeat(52));
  for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.n}${r.d ? `  — ${r.d}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log("  " + "─".repeat(52));
  console.log(`  ${results.length - failed}/${results.length} passed` + (failed ? `  (${failed} FAILED)` : "  ✓ all green") + "\n  Razorpay payment leg → npm run verify:razorpay (needs test keys)");
  return failed;
}

let code = 0;
try { await main(); }
catch (e) { fail("Unexpected error", e instanceof Error ? e.message : String(e)); }
finally {
  try { await cleanup(); } catch (e) { console.error("cleanup warning:", e?.message); }
  // confirm stock restored
  if (original) {
    const now = await stockOf(original.variantId);
    if (now === original.stock) pass("Stock restored", `${original.slug} (${original.size}) back to ${now}`);
    else fail("Stock restored", `expected ${original.stock}, got ${now} — MANUAL FIX NEEDED`);
  }
  code = report() > 0 ? 1 : 0;
}
process.exit(code);
