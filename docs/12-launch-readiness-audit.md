# Launch Readiness Audit — Pre-Stage-5

**Scope:** Full-codebase review across architecture, security, database, payment
flow, inventory flow, webhook robustness, deployment, Cloudflare configuration,
Supabase configuration, environment variables, SEO, accessibility,
performance, mobile UX, and general production readiness.

**Method:** Direct review of the payment/inventory/webhook/architecture core
(highest stakes — money and stock correctness) plus three parallel focused
reviews (security; SEO/accessibility/performance/mobile; deployment/
Cloudflare/Supabase/env vars), cross-checked against each other where scopes
overlapped. All findings are read-only observations — **nothing in this
document has been implemented or fixed.**

**Snapshot at time of audit:** M5 stages 1–4 complete (cart, checkout, orders,
Razorpay test-mode payments, inventory reservations, email notifications).
Stage 5 (not yet started) was the trigger for this audit.

---

## Severity summary

### HIGH — should be resolved before real customers transact

| # | Finding | Area |
|---|---|---|
| H1 | No automated sweep for expired inventory reservations — stock never self-releases from abandoned checkouts | Inventory flow |
| H2 | Payment retry after a decline creates a **new** order + reservation instead of resuming the pending one, compounding H1 | Payment / inventory flow |
| H3 | No rate limiting anywhere (checkout, webhook, PoC routes) | Security |
| H4 | No documented or working path to set production secrets on Cloudflare — `wrangler.jsonc` `vars: {}` is empty | Deployment / env vars |
| H5 | `orders.razorpay_order_id` has no index — every webhook delivery does a full table scan | Database |
| H6 | No CI/CD and no automated test suite for a payment-processing system | Production readiness |
| H7 | Cart drawer has no focus trap (WCAG 2.1 AA violation) | Accessibility |

### MEDIUM

| # | Finding | Area |
|---|---|---|
| M1 | RLS enabled with **zero** explicit policies on 8 sensitive tables — correct by omission, but undocumented and fragile | Security / Database |
| M2 | Cart/checkout "available" quantity is raw `stock_qty`, not reservation-adjusted — misleading upfront, late `409` at actual reserve | Inventory flow |
| M3 | No `refund.processed` webhook handler despite a published Returns & Exchanges policy | Payment flow |
| M4 | Confirmation page doesn't auto-poll the "processing" state as the plan specifies | Payment flow |
| M5 | No security headers configured anywhere (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) | Security |
| M6 | No production error tracking/observability (console.error only) | Production readiness |
| M7 | No top-level `global-error.tsx` boundary | Production readiness |
| M8 | `next/image` optimizer availability on Cloudflare Workers is unresolved/undocumented | Performance / Cloudflare |
| M9 | Product & category pages lack per-page OG image / Twitter card metadata | SEO |
| M10 | `muted-foreground` text (~3.2:1) fails WCAG AA contrast for body text | Accessibility |
| M11 | Cart quantity +/- buttons and drawer close button are under comfortable touch-target size | Accessibility / Mobile UX |
| M12 | Framer Motion loaded in the above-the-fold Hero, adding to LCP-critical bundle | Performance |
| M13 | Fonts lack `display: "swap"` — FOIT risk | Performance |
| M14 | Checkout order summary / Pay button isn't sticky on mobile — long scroll to the CTA | Mobile UX |
| M15 | `src/app/api/razorpay-poc/*` — unauthenticated Milestone-2 proof-of-concept routes still live in the production route tree | Security / Architecture hygiene |

### LOW

| # | Finding | Area |
|---|---|---|
| L1 | No skip-to-content link | Accessibility |
| L2 | No SRI on the Razorpay `checkout.js` script tag (industry-standard limitation, not really fixable — Razorpay/Stripe-style SDKs disallow SRI since they update frequently) | Security (informational) |
| L3 | No explicit canonical URL export (Next.js handles it via `metadataBase`, but implicitly) | SEO |
| L4 | R2 accessed via AWS SDK + env credentials rather than a native Worker R2 binding — works fine, but worth a conscious choice, not a default | Cloudflare configuration |
| L5 | No explicit `viewport` export (Next.js auto-generates the correct meta tag anyway) | Mobile UX (informational) |

**Corrections to sub-agent findings during synthesis:** one reviewer flagged
`orders.order_number` as "unique but not indexed" — this is incorrect.
`order_number text unique not null` (`init_schema.sql:109`) causes Postgres to
auto-create a unique btree index for any `UNIQUE` constraint; no action
needed there.

---

## Architecture

The overall shape is sound: server-side price/stock authority, webhook as the
payment source of truth with the browser callback as a UX convenience, atomic
DB-level stock reservation, snapshotted order line items immune to later
catalogue edits. `finalizeOrderPaid` correctly serves as the single
convergence point for both the webhook and browser paths (verified in Stage 4).

Two real gaps in the retry/abandonment story (**H1**, **H2**) mean the
"15-minute hold, then release" design on paper doesn't hold in practice yet —
see **Inventory flow** and **Payment flow** below.

**Hygiene:** `src/app/api/razorpay-poc/*` (create-order, verify-payment) are
explicitly-commented "Milestone 2 proof-of-concept only" routes, still live,
unauthenticated, and unused by the real checkout flow (which goes through
server actions in `src/lib/checkout/actions.ts`). Low individual risk, but
they're unnecessary production attack surface and a source of confusion for
future readers (**M15**). Recommend deleting before launch.

---

## Security

- **RLS (M1):** `orders`, `order_items`, `customers`, `checkout_sessions`,
  `inventory_reservations`, `inventory_movements`, `payment_attempts`,
  `webhook_events` all have RLS enabled with **no policies**
  (`20260625120000_m5_orders.sql:173-180`). This is safe *by omission* — no
  policies means anon/authenticated get zero access, and all real writes go
  through the service-role client server-side, which bypasses RLS entirely.
  It works, but it's undocumented intent rather than an audited policy set —
  worth a comment in the migration explaining this is deliberate, so a future
  contributor doesn't "fix" it by loosening RLS incorrectly.
- **Rate limiting (H3):** Confirmed absent everywhere — `placeOrder`,
  `confirmPayment`, the webhook route, and the PoC routes all accept unlimited
  requests. The M5 plan itself calls for this (§11) and it was never built.
  Concretely exploitable today: repeated `placeOrder` calls can reserve stock
  (each hold ties up real inventory for up to 15 minutes) with no cost to the
  caller, which is also a vector for denial-of-stock against real customers.
- **Secrets handling:** Clean. All server-only secrets
  (`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `R2_SECRET_ACCESS_KEY`) are only
  referenced from server-only modules; none leak into `"use client"` code.
  `.gitignore` correctly excludes all `.env*` except the example template.
- **CSRF:** Next.js 15's server actions carry built-in origin/CSRF protection;
  no gap found, though it's implicit rather than documented.
- **Input validation:** Shipping form validation
  (`src/lib/checkout/schema.ts`) is genuinely strong — real regex checks on
  phone/pincode/email, length caps on free-text fields, re-validated
  server-side (never trusts the client). No injection risk found — all
  Supabase calls use parameterized filters/RPC arguments, never string
  concatenation.
- **XSS:** No `dangerouslySetInnerHTML` on user-supplied data anywhere in the
  app; the one usage (`src/components/seo/json-ld.tsx`) serializes our own
  structured data, not user input. Email templates (Stage 4) escape all
  user-supplied fields via `escapeHtml()`.
- **Security headers (M5):** None configured — no CSP, `X-Frame-Options`,
  HSTS, or `X-Content-Type-Options` anywhere in `next.config.ts` or
  `wrangler.jsonc`. Low urgency pre-launch but standard practice for any
  production storefront handling payments.
- **Webhook security:** Genuinely solid — HMAC verification via a real
  constant-time comparison (`timingSafeEqualHex`, XOR over every byte, no
  early exit), raw body preserved for signature matching, POST-only,
  idempotent via `webhook_events`' primary key. No changes needed.

---

## Database

Schema is well-designed: UUID PKs, `CHECK` constraints matching the documented
state machines, `ON DELETE CASCADE` where appropriate, snapshotted order data
immune to catalogue drift. Two concrete points:

- **Missing index (H5):** `orders.razorpay_order_id` has no index, but the
  webhook route queries it directly on every single payment event
  (`route.ts:53`, `.eq("razorpay_order_id", ...)`). Fine at current volume;
  becomes a real bottleneck as `orders` grows. `payment_attempts` already
  correctly indexes both `order_id` and `razorpay_order_id`
  (`20260625120000_m5_orders.sql:37-38`) — `orders` itself was missed.
  ```sql
  create index if not exists orders_razorpay_order_id_idx
    on orders(razorpay_order_id);
  ```
- **`order_number`:** already uniquely indexed automatically via its `unique`
  constraint — no action needed (see correction above).

---

## Payment flow

- **Retry duplicates orders (H2):** `checkout-client.tsx`'s `onSubmit` always
  calls `placeOrder` fresh — there's no concept of resuming an existing
  `pending_payment` order. If a customer's card is declined and they click
  "Pay securely" again, a **second** order + a **second** stock reservation is
  created for the same items, while the first order's hold remains active
  until its 15-minute expiry (which, per H1, never actually fires
  automatically). This directly contradicts the M5 plan's own documented
  design (`06-milestone-5-plan.md` §4: "A retry after a decline creates a
  *new* `payment_attempts` row... against the same `orders` row — the
  reservation is preserved until it expires"). Combined with H1, retried or
  abandoned checkouts accumulate stuck holds indefinitely, with no automatic
  recovery — a slow, silent shrinkage of real availability.
- **No refund automation (M3):** `docs/policies/return-exchange-policy.md` and
  the state machine both describe a `refunded` state, but the webhook route
  only handles `payment.captured` / `order.paid` / `payment.failed` — no
  `refund.processed` handler exists. This is explicitly annotated "(later)" in
  the plan, so it's a known deferral, not a surprise — but it means every
  refund today requires a fully manual Razorpay-dashboard + Supabase-Studio
  process with no audit trail automation, which is worth resourcing before
  the Returns policy sees real traffic.
- **No confirmation-page polling (M4):** the plan (§8) specifies "confirmation
  page polls order status" for the case where the browser redirect beats the
  webhook. The actual page just says "This can take a few moments... refresh"
  with no auto-refresh. Practical impact is limited since the primary path
  (`confirmPayment`) already awaits `finalizeOrderPaid` before redirecting, so
  the pending state mostly only shows on direct/edge navigation — but it's a
  real gap versus the documented design.
- **Signature verification, both paths:** both the webhook and the browser
  callback independently verify signatures before calling
  `finalizeOrderPaid` — correct defense in depth, no issue.

---

## Inventory flow

- **No expiry sweep running (H1):** `release_expired_reservations()` exists as
  a Postgres function (`20260625120000_m5_orders.sql:148-168`) but nothing
  calls it — no cron route in `src/app/api/**`, no `wrangler.jsonc` scheduled
  trigger, no Supabase `pg_cron` job. `CRON_SECRET` is defined in
  `.env.example` and referenced only in comments, never in actual code. This
  is the single most important operational gap found: reservations that
  should expire and return stock **never do**, and — critically —
  `reserve_stock`'s availability check sums **all** rows with
  `status = 'held'` regardless of `expires_at`
  (`20260625120000_m5_orders.sql:80-86`), so an unswept expired hold
  continues to block real availability forever. Every abandoned checkout
  permanently and silently reduces sellable stock until someone manually runs
  the RPC.
- **Availability display (M2):** `repriceCart` (`src/lib/checkout/reprice.ts:37`)
  sets `available = variant.stockQty` — the raw column, not
  `stock_qty − held reservations`. The actual oversell guard is correctly
  enforced downstream at `reserve_stock` (row-locked, held-quantity-aware), so
  this is **not** a safety bug — but the cart/checkout UI can show stock as
  available when it's actually spoken for elsewhere, leading to a late `409`
  at the reserve step instead of an accurate number shown upfront.
- **Everything else** (reserve/confirm/release transitions, movement ledger,
  RLS-deny-anon on these tables) verified correct and matches the documented
  state machine — re-confirmed by both `verify:supabase` and `verify:razorpay`
  passing in full during Stage 3.6/4 work this session.

---

## Webhook robustness

Already covered under Security — summary: HMAC verification is correct and
constant-time, idempotency via `webhook_events` primary key is correct,
raw-body handling is correct, unknown-order events are acked (not retried)
with a warning log. No changes needed here. The only related gap is the
missing expiry cron (H1), which is an inventory-lifecycle issue, not a
webhook-correctness one.

---

## Deployment

- **No CI/CD (H6):** no `.github/workflows/`, no `test` script in
  `package.json`, no `*.test.ts`/`*.spec.ts` files anywhere. The `verify:*.mjs`
  scripts (`verify:supabase`, `verify:razorpay`, `verify:email`,
  `verify:journey`) provide real integration coverage of the critical
  payment/inventory paths, but they're run manually, not on every change —
  there's nothing stopping a regression from shipping unnoticed.
- **Error boundaries:** `src/app/error.tsx` and `src/app/not-found.tsx` both
  exist and are reasonable. `global-error.tsx` (top-level, catches errors
  outside the app's own error boundary) is missing (M7).
- **Observability:** no Sentry or equivalent — `error.tsx` only
  `console.error`s (M6). For a payment-processing app, production errors are
  currently invisible unless someone is watching server logs live.

---

## Cloudflare configuration

- `wrangler.jsonc`: `nodejs_compat` and a reasonable `compatibility_date` are
  set correctly (needed for `node:crypto` in the Razorpay/email HMAC code).
  Assets binding is configured. No R2 bucket binding — R2 is reached only via
  the AWS S3 SDK with env credentials (`src/lib/r2.ts`), which works but is a
  deliberate-vs-default choice worth confirming (L4). No KV/Durable
  Objects/scheduled triggers configured (expected at this stage, but a
  scheduled trigger is exactly what H1 needs).
- **`next/image` optimizer on Workers (M8):** `next.config.ts` correctly
  whitelists R2's `remotePatterns` for `next/image`, but whether Next's image
  optimizer actually runs under the Workers runtime (vs. needing
  `unoptimized: true` or a Cloudflare Images loader) isn't resolved in the
  config or documented anywhere. Worth confirming before launch — silently
  falling back to unoptimized images would hurt Core Web Vitals on an
  image-heavy storefront.
- `.wrangler/` and `.open-next/` build artifacts are correctly gitignored.

---

## Supabase configuration

- `src/lib/supabase/server.ts` creates a fresh client per call with
  `persistSession: false` — correct for a serverless/edge runtime (no
  connection-pool leak risk).
- `src/lib/supabase/client.ts` (anon key, browser) is only used for public
  catalogue reads; no code path was found using it for orders/customers/
  payment data, and RLS would block that anyway even if it were attempted.
- Schema/migrations are otherwise solid (see Database section for the one
  concrete gap, H5).

---

## Environment variables

- `.env.example` is complete and accurately mirrors every `process.env.*`
  reference actually used in `src/` and `scripts/` — no drift found.
- **Production deployment gap (H4):** `wrangler.jsonc`'s `vars` object is
  empty, and while `docs/08-supabase-setup-and-verification.md` notes "the
  same values go into Cloudflare Pages project settings at deploy time," there
  is no actual runbook for *how* (dashboard steps, or `wrangler secret put
  <NAME>` per variable). `.env.local` is dev-only and gitignored — it will
  not exist in the deployed Cloudflare environment. Right now, a deploy would
  build successfully and then fail at runtime on the first Supabase/Razorpay/
  Resend/R2 call. This needs a concrete pre-Stage-5-launch checklist:
  which vars are secrets (`wrangler secret put`) vs. plain vars, and where
  each one is set.

---

## SEO

Foundation is good — comprehensive `sitemap.ts`, correct `robots.ts`
(disallows `/cart`), and JSON-LD covering Organization/WebSite/Product/
Breadcrumb. Gaps are all incremental, not structural:

- Product and category pages don't set per-page OG images — social shares
  fall back to the generic site logo instead of the actual product photo
  (M9).
- No `twitter` card metadata block anywhere (part of M9).
- No explicit canonical URL export — Next.js's `metadataBase` handles this
  implicitly, which works but isn't documented as an intentional choice (L3).

---

## Accessibility

- **Cart drawer focus trap (H7):** `cart-drawer.tsx` has `aria-modal="true"`
  and Escape-key handling, but Tab does **not** loop within the drawer while
  open — a real WCAG 2.1 AA violation. Notably, `mobile-nav.tsx` implements
  this correctly (lines 28–47), so there's a working reference pattern in the
  same codebase to reuse.
- **Contrast (M10):** `--muted-foreground: #7a6f63` on `--background: #faf6f0`
  measures ~3.2:1, below the 4.5:1 required for body text under WCAG AA
  (only large text ≥18pt bold/24pt would pass at this ratio). This token is
  used widely for descriptive text, form hints, and secondary labels.
- **Touch targets (M11):** cart quantity +/- buttons (~26px) and the drawer's
  close button (~28px) are under the comfortable 44px guideline (AA minimum
  is 24px, so these are marginally compliant, not failing outright, but worth
  tightening for a mobile-heavy storefront).
- **What's solid:** form fields correctly pair `aria-invalid` with
  `aria-describedby`; all interactive icons have `aria-label`s; product images
  have meaningful alt text; mobile nav's focus trap is a good, reusable
  pattern.
- Missing skip-to-content link (L1) — low impact given the nav isn't long.

---

## Performance

- All product imagery already uses `next/image` with explicit
  width/height/`sizes` and an aspect-ratio container — no layout-shift risk
  found, this is done well.
- **Hero animation cost (M12):** `home/hero.tsx` is a `"use client"` component
  importing Framer Motion, and it's above the fold — this adds real weight to
  the LCP-critical path. Worth a Lighthouse check to quantify actual impact
  before deciding whether to trim it.
- **Font loading (M13):** Fraunces/Inter load via `next/font/google` (good
  baseline) but without `display: "swap"`, risking a flash-of-invisible-text
  window on slower connections.
- `next.config.ts`'s R2 `remotePatterns` are configured correctly for both
  `r2.dev` and `r2.cloudflarestorage.com` — no image-domain misconfiguration.

---

## Mobile UX

- **Checkout CTA reachability (M14):** the order summary/Pay button uses
  `lg:sticky` — sticky only ≥1024px. On mobile, the total and "Pay securely"
  button sit at the bottom of a long single-column stack below the entire
  shipping form, meaning a real scroll-heavy path to purchase and back up to
  see validation errors.
  Same underlying cause as M14: `checkout-client.tsx`'s grid stacks vertically
  below `lg`, and nothing pins the CTA on narrow viewports.
- Touch targets: see Accessibility (M11) — same root cause, mobile-relevant
  either way.
- Viewport meta: no explicit `viewport` export, but Next.js's default is
  already correct (`width=device-width, initial-scale=1`) — informational
  only (L5).

---

## Production readiness (cross-cutting)

Already covered above by reference — consolidated here for scanning:

- H1 (no expiry cron), H2 (retry duplication), H3 (no rate limiting), H4 (no
  production env var path), H6 (no CI/tests) are the items that most directly
  determine whether this is safe to put in front of real paying customers.
  H4 in particular is a hard blocker — the app cannot function in production
  at all without it, regardless of code correctness.
- M6/M7 (no observability, no global error boundary) mean that if something
  does go wrong in production, there's currently no way to find out except a
  customer complaint.
- Live Razorpay keys remain correctly deferred per the M5 plan (§14 test
  checklist gates that switch) — not a bug, just a reminder that this audit
  was performed entirely in Razorpay Test Mode, as it should be.

---

## Suggested order of attack (not a decision, just a starting point for discussion)

1. H4 (env vars) and H1+H2 (reservation lifecycle) — these determine whether
   the store can run at all, and whether stock stays accurate.
   H5 (index) is a 1-line migration worth bundling with H1's cron work.
2. H3 (rate limiting) and H7 (focus trap) — both are contained, well-scoped
   fixes.
3. H6 (CI/tests) — likely the largest single effort; can be scoped
   incrementally starting with the existing `verify:*.mjs` scripts wired into
   a CI job.
4. Everything MEDIUM/LOW — mostly independent, can be picked up in any order
   or deferred past initial launch without blocking real transactions.

No implementation has been done as part of this audit — awaiting direction on
which items to act on before Stage 5.
