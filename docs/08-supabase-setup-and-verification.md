# Stage 2.5 — Supabase Setup & Verification (before Razorpay)

Goal: connect the **real** Supabase Production database and prove the order +
inventory foundation works **before** any payment code is added. Money enters
only after this report is green.

---

## Step 1 — Create the Supabase project

1. supabase.com → **New project**, name it **Velmaya Production**.
2. Choose a region close to your customers (e.g. **Mumbai / ap-south-1**).
3. Set a **strong database password** and store it in your password manager.
4. Wait for provisioning to finish.

## Step 2 — Get the keys (Project Settings → API)

| Key | Where it goes | Notes |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | public |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` | **server-only secret** |

## Step 3 — Create `.env.local` (never commit it)

Copy `.env.example` → `.env.local` and fill the three Supabase values. `.env*`
is already gitignored, so secrets stay off GitHub. **Do not paste keys into
chat** — the file is all I need.

## Step 4 — Apply the migrations

Two migrations, in order, from `supabase/migrations/`:
1. `20260624000000_init_schema.sql`
2. `20260625120000_m5_orders.sql`

**Option A — Supabase SQL Editor (simplest):** open each file, paste its
contents into the SQL Editor, and run — init first, then M5.

**Option B — Supabase CLI:**
```
supabase link --project-ref <your-ref>
supabase db push
```

## Step 5 — Run the verification report

```
npm run verify:supabase
```
(That runs `node --env-file=.env.local scripts/verify-supabase.mjs`.)

The script is **self-contained and self-cleaning**: it creates a temporary
category/product/variant, exercises the full lifecycle against the real DB, then
deletes everything it created — your Production data stays pristine.

---

## What the report verifies

| Check | Confirms |
|---|---|
| Connectivity | service-role client reaches the DB |
| Tables exist | all 11 order/inventory/catalogue tables created by the migrations |
| Seed temp catalogue | category → product → variant insert works |
| Order numbering | `order_number` default produces `VLM-000000` format |
| Checkout records | customer + checkout_session + order + order_items created |
| Reservation: reserve | `reserve_stock` → `held`, availability 5 → 3 |
| Reservation: confirm | `confirm_reservations` → `confirmed`, stock_qty → 3 |
| Reservation: release | `release_reservations` → `released`, stock unchanged |
| Reservation: expiry | `release_expired_reservations` → released + order `cancelled` |
| inventory_movements | `RESERVATION`, `SALE`, `RESERVATION_RELEASE` rows logged |
| RLS: orders | anon client **cannot** read orders (RLS enforced) |
| webhook_events idempotency | duplicate `event_id` rejected by the primary key |

A green run is the gate to **Stage 3 (Razorpay, test mode only)**.

---

## Notes

- The storefront still reads the **mock catalogue** (`src/lib/products`) until
  real product data + photography is loaded; the data layer swaps to Supabase
  reads at that point (see the data-layer memory / docs/06 §2). Stage 2.5
  verifies the **order + inventory** plumbing, which is what payments depend on.
- Keep `.env.local` local for now; the same values go into Cloudflare Pages
  project settings at deploy time.
- Razorpay stays in **Test Mode** until the full order→payment→webhook flow
  passes end to end.
