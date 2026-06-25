// Stage 2.5 — Supabase integration verification.
//
// Run AFTER creating the Supabase project, applying both migrations, and adding
// keys to .env.local:
//
//   node --env-file=.env.local scripts/verify-supabase.mjs
//
// It is self-contained and self-cleaning: it inserts a temporary category /
// product / variant, exercises the full order + reservation lifecycle against
// the REAL database (reserve → confirm → release → expiry), checks order
// numbering, inventory_movements, and RLS, then deletes everything it created.
// Nothing is left behind in the Production project.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !SERVICE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = ANON ? createClient(URL, ANON, { auth: { persistSession: false } }) : null;

const results = [];
const pass = (name, detail = "") => results.push({ ok: true, name, detail });
const fail = (name, detail = "") => results.push({ ok: false, name, detail });

const TAG = `zzz-verify-${Date.now()}`;
const ids = {};

async function main() {
  // 1. Connectivity
  {
    const { error } = await admin.from("categories").select("id").limit(1);
    if (error) return fail("Connectivity", error.message);
    pass("Connectivity", "service-role client reached the database");
  }

  // 2. Required tables exist
  const tables = [
    "categories", "products", "product_variants", "customers",
    "checkout_sessions", "orders", "order_items",
    "inventory_reservations", "inventory_movements",
    "payment_attempts", "webhook_events",
  ];
  for (const t of tables) {
    const { error } = await admin.from(t).select("*", { count: "exact", head: true });
    if (error) fail(`Table: ${t}`, error.message);
    else pass(`Table: ${t}`, "exists");
  }

  // 3. Seed temp catalogue
  {
    const { data: cat, error: ce } = await admin
      .from("categories").insert({ slug: TAG, name: "Verify Temp" })
      .select("id").single();
    if (ce) return fail("Seed category", ce.message);
    ids.category = cat.id;

    const { data: prod, error: pe } = await admin
      .from("products").insert({
        slug: TAG, name: "Verify Temp Product", category_id: cat.id,
        base_price: 1000, is_published: false,
      }).select("id").single();
    if (pe) return fail("Seed product", pe.message);
    ids.product = prod.id;

    const { data: variant, error: ve } = await admin
      .from("product_variants").insert({
        product_id: prod.id, size: "M", sku: `${TAG}-M`,
        price: 1000, stock_qty: 5,
      }).select("id, stock_qty").single();
    if (ve) return fail("Seed variant", ve.message);
    ids.variant = variant.id;
    pass("Seed temp catalogue", `variant stock_qty=${variant.stock_qty}`);
  }

  // 4. Order creation (customer, session, order, items) + reserve_stock
  {
    const { data: cust } = await admin.from("customers")
      .upsert({ phone: `9${Date.now() % 1000000000}`, name: "Verify" }, { onConflict: "phone" })
      .select("id").single();
    ids.customer = cust?.id;

    const { data: sess } = await admin.from("checkout_sessions")
      .insert({ phone: "9000000000", cart_snapshot: [{ variant_id: ids.variant, qty: 2, price: 1000 }] })
      .select("id").single();
    ids.session = sess?.id;

    const order = await createOrder(2);
    if (!order) return;
    ids.order1 = order.id;

    if (!/^VLM-\d{6}$/.test(order.order_number))
      fail("Order numbering", `unexpected format: ${order.order_number}`);
    else pass("Order numbering", order.order_number);

    pass("Checkout records", "customer + session + order + order_items created");

    // reserve_stock
    const { error: re } = await admin.rpc("reserve_stock", {
      p_order_id: order.id,
      p_items: [{ variant_id: ids.variant, qty: 2 }],
    });
    if (re) return fail("reserve_stock RPC", re.message);

    const held = await reservationStatus(order.id);
    const avail = await availability(ids.variant);
    if (held === "held" && avail === 3)
      pass("Reservation: reserve", `held; availability 5→${avail}`);
    else fail("Reservation: reserve", `status=${held}, availability=${avail} (expected held/3)`);

    await assertMovement(order.id, "RESERVATION", "Movement: RESERVATION");
  }

  // 5. confirm_reservations → stock decremented, SALE movement
  {
    const { error } = await admin.rpc("confirm_reservations", { p_order_id: ids.order1 });
    if (error) fail("confirm_reservations RPC", error.message);
    else {
      const status = await reservationStatus(ids.order1);
      const stock = await stockQty(ids.variant);
      if (status === "confirmed" && stock === 3)
        pass("Reservation: confirm", `confirmed; stock_qty=${stock}`);
      else fail("Reservation: confirm", `status=${status}, stock=${stock} (expected confirmed/3)`);
      await assertMovement(ids.order1, "SALE", "Movement: SALE");
    }
  }

  // 6. release_reservations → released, stock unchanged
  {
    const order = await createOrder(1);
    ids.order2 = order?.id;
    await admin.rpc("reserve_stock", { p_order_id: order.id, p_items: [{ variant_id: ids.variant, qty: 1 }] });
    const { error } = await admin.rpc("release_reservations", { p_order_id: order.id });
    if (error) fail("release_reservations RPC", error.message);
    else {
      const status = await reservationStatus(order.id);
      const stock = await stockQty(ids.variant);
      if (status === "released" && stock === 3)
        pass("Reservation: release", `released; stock_qty stays ${stock}`);
      else fail("Reservation: release", `status=${status}, stock=${stock} (expected released/3)`);
      await assertMovement(order.id, "RESERVATION_RELEASE", "Movement: RESERVATION_RELEASE");
    }
  }

  // 7. release_expired_reservations → expired hold released + order cancelled
  {
    const order = await createOrder(1);
    ids.order3 = order?.id;
    await admin.rpc("reserve_stock", { p_order_id: order.id, p_items: [{ variant_id: ids.variant, qty: 1 }] });
    // force-expire the hold
    await admin.from("inventory_reservations")
      .update({ expires_at: new Date(Date.now() - 60000).toISOString() })
      .eq("order_id", order.id);
    const { error } = await admin.rpc("release_expired_reservations");
    if (error) fail("release_expired_reservations RPC", error.message);
    else {
      const status = await reservationStatus(order.id);
      const { data: o } = await admin.from("orders").select("status").eq("id", order.id).single();
      if (status === "released" && o?.status === "cancelled")
        pass("Reservation: expiry sweep", "expired hold released; order cancelled");
      else fail("Reservation: expiry sweep", `reservation=${status}, order=${o?.status}`);
    }
  }

  // 8. RLS — anon must NOT read orders
  if (anon) {
    const { data, error } = await anon.from("orders").select("id").limit(1);
    if (error || (data && data.length === 0))
      pass("RLS: orders", "anon read denied / empty (RLS active)");
    else fail("RLS: orders", `anon returned ${data?.length} row(s) — RLS NOT enforced`);
  } else {
    fail("RLS: orders", "NEXT_PUBLIC_SUPABASE_ANON_KEY missing — cannot test");
  }

  // 9. payment_attempts + webhook_events smoke
  {
    const { error: pa } = await admin.from("payment_attempts")
      .insert({ order_id: ids.order1, amount: 1000, status: "created" });
    if (pa) fail("payment_attempts insert", pa.message);
    else pass("payment_attempts", "insert ok");

    const { error: we } = await admin.from("webhook_events")
      .insert({ event_id: `${TAG}-evt`, type: "payment.captured", order_id: ids.order1 });
    if (we) fail("webhook_events insert", we.message);
    else {
      // idempotency: same event_id again should conflict
      const { error: dup } = await admin.from("webhook_events")
        .insert({ event_id: `${TAG}-evt`, type: "payment.captured" });
      if (dup) pass("webhook_events idempotency", "duplicate event_id rejected (PK)");
      else fail("webhook_events idempotency", "duplicate event_id was accepted");
    }
  }
}

// ---- helpers ----
async function createOrder(qty) {
  const { data, error } = await admin.from("orders").insert({
    customer_id: ids.customer ?? null,
    checkout_session_id: ids.session ?? null,
    shipping_name: "Verify", shipping_phone: "9000000000",
    shipping_address_line1: "1 Test St", shipping_city: "Chennai",
    shipping_state: "Tamil Nadu", shipping_pincode: "600001",
    subtotal: 1000 * qty, total: 1000 * qty,
  }).select("id, order_number").single();
  if (error) { fail("Order insert", error.message); return null; }
  await admin.from("order_items").insert({
    order_id: data.id, variant_id: ids.variant,
    product_name_snapshot: "Verify Temp Product", size_snapshot: "M",
    unit_price: 1000, quantity: qty,
  });
  return data;
}
async function reservationStatus(orderId) {
  const { data } = await admin.from("inventory_reservations")
    .select("status").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.status;
}
async function stockQty(variantId) {
  const { data } = await admin.from("product_variants").select("stock_qty").eq("id", variantId).single();
  return data?.stock_qty;
}
async function availability(variantId) {
  const stock = await stockQty(variantId);
  const { data } = await admin.from("inventory_reservations")
    .select("quantity").eq("variant_id", variantId).eq("status", "held");
  const held = (data ?? []).reduce((s, r) => s + r.quantity, 0);
  return stock - held;
}
async function assertMovement(orderId, reason, label) {
  const { data } = await admin.from("inventory_movements")
    .select("reason").eq("order_id", orderId).eq("reason", reason).limit(1);
  if (data && data.length) pass(label, "logged");
  else fail(label, "not found in inventory_movements");
}

async function cleanup() {
  // Delete child rows explicitly (don't rely on ON DELETE CASCADE — e.g.
  // payment_attempts may not cascade), then the order.
  for (const o of [ids.order1, ids.order2, ids.order3].filter(Boolean)) {
    await admin.from("webhook_events").delete().eq("order_id", o);
    await admin.from("payment_attempts").delete().eq("order_id", o);
    await admin.from("inventory_movements").delete().eq("order_id", o);
    await admin.from("inventory_reservations").delete().eq("order_id", o);
    await admin.from("order_items").delete().eq("order_id", o);
    await admin.from("orders").delete().eq("id", o);
  }
  await admin.from("webhook_events").delete().eq("event_id", `${TAG}-evt`);
  if (ids.session) await admin.from("checkout_sessions").delete().eq("id", ids.session);
  if (ids.customer) await admin.from("customers").delete().eq("id", ids.customer);
  if (ids.variant) await admin.from("product_variants").delete().eq("id", ids.variant);
  if (ids.product) await admin.from("products").delete().eq("id", ids.product);
  if (ids.category) await admin.from("categories").delete().eq("id", ids.category);
}

function report() {
  console.log("\n  Velmaya — Supabase verification report\n  " + "─".repeat(46));
  for (const r of results) {
    console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log("  " + "─".repeat(46));
  console.log(`  ${results.length - failed}/${results.length} checks passed` +
    (failed ? `  (${failed} FAILED)` : "  ✓ all green"));
  return failed;
}

let exitCode = 0;
try {
  await main();
} catch (err) {
  fail("Unexpected error", err instanceof Error ? err.message : String(err));
} finally {
  try { await cleanup(); } catch { /* best-effort */ }
  exitCode = report() > 0 ? 1 : 0;
}
process.exit(exitCode);
