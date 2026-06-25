# Milestone 5 — Cart, Orders & Razorpay Checkout (Technical Plan)

**Status:** Plan only — no code. For approval before implementation.
**Builds on:** existing schema (`supabase/migrations`), `src/lib/razorpay/*`
(`createRazorpayOrder`, `verifyRazorpaySignature`), and the data layer
(`src/lib/products`). **Razorpay TEST MODE only** until the full flow is verified.

**Companion doc:** [`07-payment-order-state-machine.md`](07-payment-order-state-machine.md)
— the authoritative state diagrams for order, payment, payment-attempt, and
reservation lifecycles, plus success/failure/expiry/cancellation/webhook flows.

## Project decisions (confirmed)

| Decision | Value |
|---|---|
| Supabase | **Production** project (named *Velmaya Production*) |
| Razorpay | **Test Mode only** (live keys deferred until §14 passes) |
| Email provider | **Resend** |
| Reservation window | **15 minutes** |
| Shipping | **Free above ₹1499**, otherwise a **configurable flat fee** (not hardcoded) |
| Coupons | **Deferred** to a later milestone |

---

## 0. Principles

1. **The server is the source of truth.** Prices, totals, and stock are always
   recomputed server-side from the DB. The client never dictates amounts.
2. **The webhook is the source of truth for payment**, not the browser callback.
   The callback only drives UX; fulfillment is finalized by the verified webhook.
3. **No overselling.** Stock is reserved atomically at checkout; reservations
   expire and release automatically.
4. **Idempotent everywhere.** Webhooks and finalization can run more than once
   without double-decrementing stock, double-sending email, or duplicating orders.

---

## 1. Cart state approach

- **Client-side cart** (guest-friendly, zero backend cost pre-checkout):
  React context `CartProvider` + `useCart()` hook, persisted to `localStorage`.
- **Stored shape:** minimal — `{ variantId, productSlug, name, size, unitPrice, qty }[]`.
  Display-only; authoritative price/stock are revalidated server-side at checkout.
- **UI:** add-to-cart on the PDP (alongside the existing "Order on WhatsApp"),
  a cart drawer/sheet from the header bag icon, and the `/cart` page (replaces the
  current placeholder). Quantity stepper, remove, subtotal (display).
- **Revalidation:** on entering checkout, the server reprices every line and
  checks live stock; the user is told if anything changed before paying.
- **No server-side cart table** — `checkout_sessions.cart_snapshot` captures the
  authoritative snapshot at order-creation time.

---

## 2. Supabase tables used (all already in schema)

| Table | Role in M5 |
|---|---|
| `product_variants` | `stock_qty` is the reservable inventory (guarded by `CHECK (stock_qty >= 0)`) |
| `checkout_sessions` | snapshot of the cart + contact at checkout start; `converted_order_id` on success |
| `orders` | one row per checkout attempt; `status`, totals, `razorpay_order_id/payment_id` |
| `order_items` | line items with **price/name/size snapshots** (immune to later catalogue edits) |
| `inventory_reservations` | `held → confirmed → released`, with `expires_at` |
| `inventory_movements` | append-only ledger (`sale`/`restock`/`return`/`adjustment`) for audit |
| `customers` | upserted by phone/email at checkout |
| `coupons` | optional; discount applied server-side (can defer to M5.x if out of scope) |

### Additive migrations proposed for M5 (no breaking changes)
- **`orders.payment_status`** column — separate the *payment* outcome from the
  *order lifecycle* (see §7). Values: `created`, `authorized`, `captured`,
  `failed`, `refunded`. Keeps `orders.status` for lifecycle.
- **`orders.order_notes`** (text, nullable) and **`orders.gift_message`** (text,
  nullable) — optional customer notes / gift message captured at checkout.
- **`payment_attempts`** table — one order can record **multiple** Razorpay
  attempts (retry after a decline). Latest terminal attempt drives
  `orders.payment_status`:
  ```
  payment_attempts (
    id uuid pk, order_id uuid -> orders,
    razorpay_order_id text, razorpay_payment_id text,
    status text check (status in
      ('created','authorized','captured','failed')),
    amount numeric(10,2), method text,
    error_code text, error_description text,
    created_at timestamptz, updated_at timestamptz )
  ```
- **`webhook_events`** table — `(event_id text primary key, type text, order_id
  uuid, payload jsonb, received_at timestamptz)` for **webhook idempotency**.
- **`inventory_movements.reason`** — replace the current check constraint with the
  expanded set: **`SALE`, `RESERVATION`, `RESERVATION_RELEASE`, `RESTOCK`,
  `MANUAL_ADJUSTMENT`, `REFUND`** (no data exists yet, so the swap is safe).
- A Postgres function **`reserve_stock(order_id, items[])`** (RPC) for atomic
  multi-line reservation (see §3).
- Postgres functions **`confirm_reservations(order_id)`**,
  **`release_reservations(order_id)`**, and **`release_expired_reservations()`**
  for safe lifecycle transitions and stock return.
- **`store_settings`** (single-row table) **or** env-backed config module for
  shipping settings (see §3a) — values are read at runtime, never hardcoded.

These are purely additive — existing tables/columns are untouched.

---

## 3. Inventory reservation / release logic

**Model:** `product_variants.stock_qty` = **physical on-hand** units. Soft holds
live in `inventory_reservations`. Shopper-facing **availability** is computed:

```
available(variant) = stock_qty − Σ qty of reservations WHERE status = 'held'
```

`inventory_movements` is the append-only audit ledger; every step writes a row
with one of: `SALE`, `RESERVATION`, `RESERVATION_RELEASE`, `RESTOCK`,
`MANUAL_ADJUSTMENT`, `REFUND`.

### Reservation lifecycle (states & transitions)

```
                         ┌───────────── reserve_stock() ─────────────┐
                         ▼                                            │
   (none) ──reserve──▶ HELD ──payment captured (webhook)──▶ CONFIRMED ──▶ (fulfilled)
                         │                                            
                         ├── payment.failed (webhook) ──▶ RELEASED     
                         ├── checkout cancelled ────────▶ RELEASED     
                         └── expires_at passed (cron) ──▶ RELEASED     
```

`inventory_reservations.status` stays the existing `held | confirmed | released`
(expiry is recorded as a `released` row via the cron job).

| Transition | stock_qty | reservation | movement row |
|---|---|---|---|
| **Reserve** (order create) | unchanged | insert `held`, `expires_at = now()+15m` | `RESERVATION` (−qty) |
| **Confirm** (payment captured) | **−qty** | `held → confirmed` | `SALE` (−qty) |
| **Release** (fail / cancel / expiry) | unchanged | `held → released` | `RESERVATION_RELEASE` (+qty) |
| Restock / correction / refund-to-stock | ±qty | — | `RESTOCK` / `MANUAL_ADJUSTMENT` / `REFUND` |

Because availability subtracts only `held` reservations, confirming (which both
removes the hold **and** decrements `stock_qty`) leaves availability unchanged at
capture — correct, since the unit was already unavailable while held.

### Reserve (atomic, at order creation) — `reserve_stock(order_id, items[])`
A single transaction:
```
for each line:
  -- guard against overselling using computed availability
  if (stock_qty − held_qty) < line.qty for that variant -> RAISE -> rollback all
  insert inventory_reservations(order_id, variant_id, qty,
                                status='held', expires_at = now()+'15 min')
  insert inventory_movements(variant_id, change_qty=-qty,
                             reason='RESERVATION', order_id)
```
Row-level locking (`SELECT … FOR UPDATE` on the variant) serialises concurrent
checkouts so two buyers can't both grab the last unit. On any shortfall, **nothing**
is reserved and the API returns `409 insufficient_stock` with the offending items.

### Confirm — `confirm_reservations(order_id)` (idempotent)
On verified `payment.captured`: reservations `held → confirmed`;
`stock_qty −= qty`; write `SALE` movements. Skips if already `confirmed`.

### Release — `release_reservations(order_id)` (idempotent)
On `payment.failed`, cancel, or expiry: reservations `held → released`; write
`RESERVATION_RELEASE` movements. `stock_qty` is untouched (it was never decremented
for a hold). Releasing a `confirmed`/`released` reservation is a no-op.

### Expiry job — `release_expired_reservations()` (cron)
Runs every ~2–5 min (Supabase `pg_cron`, or a `CRON_SECRET`-protected Next route):
```
for reservations where status='held' and expires_at < now():
   release_reservations(order_id)        -- returns availability
   if order still 'pending_payment' -> order.status='cancelled'
```
This is the safety net for abandoned checkouts (stock release after expired payment).

## 3a. Configuration-driven shipping

Shipping is **never hardcoded**. A single source of truth exposes:

| Setting | Default | Source |
|---|---|---|
| `freeShippingThreshold` | ₹1499 | config |
| `flatShippingFee` | configurable (e.g. ₹79) | config |

`shipping_fee = subtotal >= freeShippingThreshold ? 0 : flatShippingFee`, computed
**server-side** at order creation (and shown for transparency in the cart/checkout).

Implementation: an env-backed `commerceConfig` module
(`NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD`, `SHIPPING_FLAT_FEE`) with sensible defaults,
**or** a single-row `store_settings` table if the founder wants to change values
without a redeploy. Default plan: env-backed config now; `store_settings` table is a
trivial later swap behind the same `commerceConfig` accessor.

---

## 4. Order creation flow

```
Cart → /checkout (shipping form + repriced summary)
  → POST /api/checkout/create-order
     1. Revalidate cart: reprice from product_variants, check availability
     2. Upsert customer (by phone/email)
     3. Insert checkout_session (cart_snapshot, contact)
     4. reserve_stock(...)  ← atomic; 409 if insufficient
     5. Insert order (status='pending_payment', payment_status='created',
                      computed subtotal/shipping_fee (§3a)/total,
                      order_number=VLM-xxxxxx, order_notes?, gift_message?)
     6. Insert order_items (with price/name/size snapshots)
     7. createRazorpayOrder({ amount: total*100 paise, receipt: order_number,
                              notes:{ order_id } })  → store razorpay_order_id
        + insert payment_attempts(order_id, razorpay_order_id, status='created')
     8. Return { razorpayOrderId, keyId (public), amount, orderNumber }
```
A **retry** after a decline creates a *new* `payment_attempts` row (and, if the
Razorpay order expired, a new Razorpay order) against the same `orders` row — the
reservation is preserved until it expires.
```
  → Browser opens Razorpay Checkout (test keys)
```
If step 7 fails, the reservation is released and the order marked `cancelled`.

---

## 5. Razorpay test-mode flow

1. **Keys:** `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` = **test** keys;
   `NEXT_PUBLIC_RAZORPAY_KEY_ID` = test key id (public, used by checkout.js).
2. **Open checkout** client-side with `razorpayOrderId`, amount, prefilled
   name/email/phone, theme color = brand.
3. **Success handler** returns `razorpay_payment_id`, `razorpay_order_id`,
   `razorpay_signature` → `POST /api/checkout/verify` (UX only — see §6).
4. **Test cards:** use Razorpay's documented test card/UPI success & failure
   instruments. No live keys, no real money, until the checklist (§14) passes.
5. **Webhook** (configured in Razorpay dashboard → test mode) points at
   `/api/webhooks/razorpay` and is the authoritative finalizer.

---

## 6. Webhook verification & idempotency

**Endpoint:** `POST /api/webhooks/razorpay` (Node runtime; raw body required).

```
1. Read raw body + 'X-Razorpay-Signature' header
2. Verify HMAC-SHA256(raw_body, RAZORPAY_WEBHOOK_SECRET) === signature
   - mismatch -> 400, ignore
3. Idempotency: INSERT event_id into webhook_events
   - conflict (already processed) -> 200, skip
4. Dispatch by event type:
   - payment.captured / order.paid -> finalize order (§3 Confirm, §8)
   - payment.failed                -> release stock (§3 Release), payment_status='failed'
   - refund.processed (later)      -> payment_status='refunded', order.status='refunded'
5. Always 200 on handled/duplicate so Razorpay stops retrying
```

- The **browser `/verify` callback** also verifies the signature for an instant
  confirmation redirect, but it **must not** be the only path — if the user closes
  the tab, the webhook still finalizes. Both converge on the same idempotent
  finalize function.
- **Unknown order_id** in a webhook → log + 200 (ack) to avoid retry storms; alert.

---

## 7. payment_status & order_status (state machines)

**`orders.status` (lifecycle):**
```
pending_payment ──paid──▶ paid ──(ops)──▶ fulfilled
      │                      └──refund──▶ refunded
      ├── expiry/cancel ──▶ cancelled
      └── payment_failed ─▶ payment_failed
```

**`orders.payment_status` (payment outcome, new column):**
```
created ──▶ authorized ──▶ captured
   │            └──────────▶ failed
   └────────────────────────▶ failed
captured ──refund──▶ refunded
```
The webhook keeps both in sync (e.g. `payment.captured` → status `paid` +
payment_status `captured`).

---

## 8. Failed / expired payment handling

| Scenario | Detection | Action |
|---|---|---|
| Card declined / UPI failed | `payment.failed` webhook | release stock, `payment_failed` / `failed`; show retry on confirmation page |
| User closes tab before paying | reservation `expires_at` passes | expiry job releases stock, order `cancelled` |
| Razorpay order created, user never opens checkout | expiry job | same as above |
| Browser callback says success, webhook delayed | confirmation page polls order status | show "Payment processing…", finalize when webhook lands |
| Duplicate `payment.captured` | `webhook_events` PK conflict | skip (idempotent) |
| Payment captured but email send fails | email try/catch | order still succeeds; email retried/logged, never blocks fulfillment |
| Stock decremented but later step errors | transaction rollback | atomic — nothing persisted |

---

## 9. Email notification flow

- **Trigger:** order finalized in the webhook (payment captured) — never on the
  unverified client callback.
- **Provider:** transactional email API (recommend **Resend** for a simple HTTP
  API; alternative Brevo). Requires domain verification + `EMAIL_FROM`.
- **Two emails:**
  1. **Customer order confirmation** — order number, line items, total, shipping
     address, expected delivery window, support (WhatsApp/email) links.
  2. **Internal new-order notification** — to `SHOP_NOTIFICATION_EMAIL`.
- **Idempotency:** guard with an `orders.confirmation_email_sent_at` timestamp (or
  a flag) so webhook retries don't re-send.
- **Non-blocking:** email failure is logged and retried; it never fails the order.

---

## 10. WhatsApp post-purchase support

- **M5 scope (no extra approvals needed):** confirmation page + email include a
  **prefilled `wa.me` link** with the order number (reuses `whatsappLink()`), e.g.
  "Questions about order VLM-000123? Message us." This is immediate and free.
- **Later enhancement (flagged, not in M5):** automated WhatsApp **Business Cloud
  API** template message ("Your order is confirmed") — needs Meta WhatsApp Business
  setup, a registered number, and approved message templates. Deferred until the
  business account is provisioned.

---

## 11. Security considerations

- **Never trust client amounts** — totals recomputed server-side from `product_variants`.
- **Razorpay secret & Supabase service-role key** are server-only; only the
  Razorpay *key id* is public (`NEXT_PUBLIC_RAZORPAY_KEY_ID`).
- **Webhook HMAC verification** with `RAZORPAY_WEBHOOK_SECRET`; reject mismatches.
- **Browser verify** also checks `razorpay_signature` (order_id|payment_id HMAC).
- **Idempotency** via `webhook_events` and finalize guards (no double stock/email).
- **RLS** on all tables: anon can read published catalogue only; orders/customers/
  reservations are service-role-only (written from server routes). No client writes.
- **Rate-limit** `create-order` and `verify` (per IP/session) to deter abuse.
- **Input validation** (zod) on shipping form: pincode, phone, required fields.
- **Cron endpoints** protected by `CRON_SECRET`.
- **Node runtime** for webhook/crypto routes; raw body preserved for HMAC.

---

## 12. Environment variables required

**Already present:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`.

**New for M5:**
| Var | Purpose | Exposure |
|---|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | checkout.js needs the key id client-side | public |
| `RAZORPAY_WEBHOOK_SECRET` | verify webhook HMAC | server |
| `RESEND_API_KEY` | transactional email (Resend) | server |
| `EMAIL_FROM` | verified sender address | server |
| `SHOP_NOTIFICATION_EMAIL` | internal new-order alerts | server |
| `CRON_SECRET` | protect the expiry-cleanup route | server |
| `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` | free-shipping cutoff (₹1499) | public |
| `SHIPPING_FLAT_FEE` | flat fee below threshold | server (mirrored public for display) |

All test-mode values first. Live Razorpay keys only after §14 passes.

---

## 13. Proposed build sequence (sub-milestones)

1. **M5.1** Cart (context + persistence, drawer, `/cart`, PDP add-to-cart)
2. **M5.2** `/checkout` (shipping form + repriced summary, server revalidation)
3. **M5.3** Migrations: `payment_status`, `webhook_events`, `reserve_stock` /
   release RPCs, RLS policies
4. **M5.4** `create-order` route (reserve + Razorpay order)
5. **M5.5** Razorpay Checkout integration + `verify` route + confirmation page
6. **M5.6** Webhook route (verify + idempotency + finalize/release)
7. **M5.7** Expiry-cleanup cron route
8. **M5.8** Email notifications
9. **M5.9** WhatsApp confirmation + post-purchase link
10. **M5.10** Full manual test pass (§14), then live-key switch as a separate step

---

## 14. Manual test checklist (test mode)

- [ ] Happy path: add to cart → checkout → pay (test card) → order `paid`,
      stock decremented once, confirmation page + email received
- [ ] Repricing: edit a price/stock between add-to-cart and checkout → user warned
- [ ] Insufficient stock at reserve → `409`, no order, no stock change
- [ ] Concurrency: two simultaneous checkouts for the last unit → exactly one wins
- [ ] Payment failure (test failure card) → stock released, order `payment_failed`
- [ ] Abandonment: start checkout, never pay → after 15 min, stock released, order `cancelled`
- [ ] Webhook idempotency: replay the same `payment.captured` → no double stock/email
- [ ] Tampered signature (webhook & client verify) → rejected
- [ ] Webhook arrives before/after client redirect → order finalizes exactly once
- [ ] Email failure does not break order finalization
- [ ] Confirmation page shows order number + prefilled WhatsApp link
- [ ] RLS: anon cannot read/write orders, customers, reservations
- [ ] (Optional) refund flow updates `payment_status`/`status`

---

## 15. Credentials still needed to run (test mode)

Decisions are confirmed (see top). To actually run the flow end-to-end, the
following **test-mode** secrets need to be provided and placed in env (never
committed):

1. **Supabase Production** — project URL + anon key + service-role key.
2. **Razorpay Test Mode** — key id + key secret + webhook secret.
3. **Resend** — API key + a verified sender (`EMAIL_FROM`) + `SHOP_NOTIFICATION_EMAIL`.
4. **Shipping** — confirm the **flat fee** value (threshold fixed at ₹1499).
5. **`CRON_SECRET`** — any strong random string for the expiry-cleanup route.

Implementation can begin now against the mock data layer (cart, checkout UI,
state machine, shipping math); live Supabase/Razorpay/Resend wiring switches on as
each credential lands. **Live Razorpay keys remain out until §14 passes.**
