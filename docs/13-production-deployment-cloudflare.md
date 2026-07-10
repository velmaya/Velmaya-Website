# Stage 5 gate — Cloudflare Production Environment & Secrets (H4)

Addresses `docs/12-launch-readiness-audit.md` **H4**: `wrangler.jsonc`'s `vars`
is empty and there was no documented path to set production secrets, so a
deploy would build successfully and then fail at runtime on the first
Supabase/Razorpay/Resend call. This is a **runbook** — it documents commands
to run manually. No secret values are written to this file, to git, or to
`wrangler.jsonc`.

---

## 1. Variable inventory

Every `process.env.*` reference in `src/` and `scripts/`, categorized by
where it must be set.

### Public build-time variables (`NEXT_PUBLIC_*`)

These are inlined into the client JavaScript bundle **at `next build` time**
(see §5 — this is the part most deploy setups get wrong). Safe to expose in
the browser by design.

| Variable | Used for | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser client + build-time static generation) | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser client, RLS-gated) | Required |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Checkout.js needs the key id client-side | Required |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Click-to-chat link | Optional — falls back to `919597075752` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Footer/contact display | Optional — falls back to `shop.velmaya@gmail.com` |
| `NEXT_PUBLIC_INSTAGRAM_HANDLE` | Footer link | Optional — falls back to `labelvelmaya` |
| `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` | Shipping calc (`src/lib/commerce/config.ts`) | Optional — falls back to `1499` |
| `NEXT_PUBLIC_SHIPPING_FLAT_FEE` | Shipping calc | Optional — falls back to `79` |

### Private runtime secrets (Worker-only, via `wrangler secret put`)

Read by server-only code (Server Actions, Route Handlers) executing inside
the deployed Worker. Never prefix these with `NEXT_PUBLIC_`, never put the
values in `wrangler.jsonc`.

| Variable | Used for |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access, bypasses RLS — checkout, orders, cron sweep. **Also required at build time**, see §5. |
| `RAZORPAY_KEY_ID` | Server-side order creation (not itself sensitive, but paired with the secret below — keep both managed the same way) |
| `RAZORPAY_KEY_SECRET` | Razorpay order creation + signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC verification |
| `RESEND_API_KEY` | Transactional email sending |
| `EMAIL_FROM` | Must be an address on a Resend-verified sending domain (not secret, but must be correct — see §8) |
| `SHOP_NOTIFICATION_EMAIL` | Internal order-notification recipient (not secret) |
| `CRON_SECRET` | Bearer token protecting `/api/cron/release-expired-reservations` |

### GitHub Actions secrets (repo-level, never read by the app itself)

Used only by `.github/workflows/release-expired-reservations.yml` to call
the deployed cron route.

| Secret | Value |
|---|---|
| `PRODUCTION_URL` | The deployed Worker's base URL (e.g. `https://velmaya.<subdomain>.workers.dev` or your custom domain) |
| `CRON_SECRET` | **Must be the identical value** set as the Worker's `CRON_SECRET` in §3 — the workflow sends it as the `Authorization: Bearer` header, the route compares it against its own copy |

### Optional / deferred variables

| Variable | Status |
|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL` | Only read by `src/lib/r2.ts`, which is **not imported anywhere in `src/`** today — reserved for a future bulk photo-upload tool. Not required for the Worker to run. Set locally in `.env.local` only if/when that tooling is wired up. |
| `VERIFY_BASE_URL` | Local convenience override so `verify:cron` / `verify:razorpay` / `verify:email` can target a deployed URL instead of `http://localhost:3000`. Not read by the app itself, only by the `scripts/verify-*.mjs` tooling. |

---

## 2. Cloudflare Wrangler login / account verification

```powershell
npx wrangler login
npx wrangler whoami
```

`login` opens a browser to authorize the CLI against your Cloudflare
account. `whoami` confirms which account/email is currently authenticated —
run it before touching secrets so you're certain you're pointed at the
right Cloudflare account. (Not run as part of this session — no network
access to Cloudflare from this environment. You'll need to run these two
commands yourself.)

## 3. Worker target / name

`wrangler.jsonc` already declares the Worker identity:

```jsonc
"name": "velmaya"
```

All `wrangler secret put` / `wrangler deploy` commands below act on this
Worker by default (no `--name` flag needed, since you run them from the
project root where `wrangler.jsonc` lives). Confirm in the Cloudflare
dashboard (Workers & Pages) that a Worker named `velmaya` either already
exists or will be created on first deploy, and note whether a
`*.workers.dev` subdomain is claimed or a custom domain route is attached —
that URL is what becomes `PRODUCTION_URL` in §9.

## 4. Required Wrangler secrets

Run one command per secret. Each prompts interactively for the value (input
hidden, never touches shell history, never printed to any log):

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put SHOP_NOTIFICATION_EMAIL
npx wrangler secret put CRON_SECRET
```

`EMAIL_FROM` and `SHOP_NOTIFICATION_EMAIL` aren't sensitive, but they're
kept on the same `wrangler secret put` mechanism as the true secrets rather
than split into `wrangler.jsonc`'s `vars` — one uniform command pattern,
one source of truth in the Cloudflare dashboard, and it avoids committing
environment-specific values (even non-secret ones) into a tracked file.
This is why `wrangler.jsonc`'s `vars: {}` stays empty (see §5's note on why
that's correct, not incomplete).

Secrets persist on the Worker across future deploys — you only re-run a
`wrangler secret put` when a value rotates, not on every deploy.

To confirm what's set (names only, never values):

```powershell
npx wrangler secret list
```

## 5. NEXT_PUBLIC variables and the OpenNext build

This is the part most Cloudflare + Next.js setups get wrong, so it's worth
stating precisely:

- `NEXT_PUBLIC_*` variables are inlined into the client JS bundle **when
  `next build` runs** (which `npm run cf:build` / `cf:deploy` calls
  internally via `opennextjs-cloudflare build`). They are baked into static
  output at build time — setting them as a `wrangler secret` or in
  `wrangler.jsonc`'s `vars` **after** the build has already happened has
  **no effect on the client bundle**, because the Worker never re-reads
  them at runtime for anything already inlined.
- Two of this project's pages (`product/[slug]`, `shop/[category]`) are
  statically generated (`generateStaticParams`) and query Supabase
  **during the build** (`src/lib/products/queries.ts`). That means
  `SUPABASE_SERVICE_ROLE_KEY` must also be present **in the build
  environment**, not only as a Worker runtime secret.
- Practical consequence: whoever runs `npm run cf:deploy` needs a
  `.env.local` (already gitignored, already exists locally per
  `docs/08-supabase-setup-and-verification.md`) containing at minimum:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, plus the
  optional `NEXT_PUBLIC_*` contact/shipping vars if you want real values
  baked in instead of the code-level fallbacks.
- Next.js automatically loads `.env.local` for both `next dev` and
  `next build` — no `--env-file` flag needed for the build step (that flag
  is only used by this project's plain-Node `scripts/*.mjs` verify
  tooling, which isn't part of the Next build).
- There is only **one** Supabase environment in this project (`Velmaya
  Production`, per `docs/08`) — local dev already runs against the real
  production database, so the existing `.env.local` already satisfies the
  Supabase side of this requirement. No separate staging project exists.

## 6. Supabase production values

Already covered by `docs/08-supabase-setup-and-verification.md` §2 — no
new values beyond what's already in `.env.local`:

| Value | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` `secret` key |

Set the first two in the build-time `.env.local` (§5) and all three as
Worker secrets (§4) — the service-role key is needed in both places for
the reasons in §5; the two public ones only strictly need to be correct at
build time, but setting them as Worker secrets too is harmless and keeps
`wrangler secret list` a complete picture of the Worker's env.

## 7. Razorpay: live vs. test separation

Razorpay Test Mode and Live Mode are **separate credential sets** with
separate dashboard sections:

| | Test Mode (current) | Live Mode (go-live) |
|---|---|---|
| Key ID | `rzp_test_...` | `rzp_live_...` |
| Where | Dashboard → Settings → API Keys → **Test Mode** toggle | Same page → **Live Mode** toggle (requires KYC/activation) |
| Webhook secret | Configured under Test Mode webhooks | **Separate** webhook, configured under Live Mode webhooks — a different secret, not reused from test |
| This project's vars | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_WEBHOOK_SECRET` all currently hold **test** values | Swap all four to the live equivalents only when ready |

Per `docs/06-milestone-5-plan.md` §14 and the launch-readiness audit, the
live-key switch is a deliberate, gated decision — **not** part of this H4
change. This runbook documents *where* the live values would go
(§4 for the three server-side secrets, plus a rebuild for
`NEXT_PUBLIC_RAZORPAY_KEY_ID` per §5) so the actual cutover is a
find-and-replace of values, not new plumbing. Deploying now with test keys
still in place is expected and safe — the storefront will be live, Razorpay
stays in Test Mode until that separate go/no-go decision is made.

## 8. Resend sender / domain settings

`EMAIL_FROM` (`.env.example` default: `orders@velmaya.com`) must be an
address on a domain verified in the Resend dashboard (Domains → Add
Domain → add the DNS records Resend gives you — SPF/DKIM — at your domain
registrar/DNS host). Sending from an unverified domain fails at the Resend
API call (`src/lib/email/client.ts`), which `finalizeOrderPaid` treats as
non-fatal (order still completes; email is best-effort — see
`docs/11-stage-4-email-notifications.md`), so a misconfigured domain
degrades silently to "no emails sent" rather than a visible error. Confirm
domain verification status in the Resend dashboard before relying on order
emails in production.

## 9. CRON_SECRET and PRODUCTION_URL

- `CRON_SECRET`: generate a long random value (e.g.
  `openssl rand -hex 32`, or any password-manager-generated string ≥32
  chars). Set it in **two** places and keep them identical:
  1. Worker secret (§4: `npx wrangler secret put CRON_SECRET`)
  2. GitHub Actions repo secret (§10)
- `PRODUCTION_URL`: the deployed Worker's public base URL, confirmed in
  §3 (either the `*.workers.dev` subdomain or your custom domain). This
  only needs to exist as a GitHub Actions repo secret (§10) — the app
  itself never reads a `PRODUCTION_URL` env var.

## 10. GitHub Actions repository secrets (expiry-sweep workflow)

`.github/workflows/release-expired-reservations.yml` runs every 5 minutes
and currently no-ops (exits 0 with a log message) until both secrets
below exist — safe to leave the workflow enabled before this step.

1. GitHub → this repo → **Settings → Secrets and variables → Actions →
   New repository secret**
2. Add `PRODUCTION_URL` — the value from §9
3. Add `CRON_SECRET` — the **same** value you put into the Worker secret
   in §4
4. Optional: **Actions → Release expired inventory reservations → Run
   workflow** to trigger it manually once and confirm a 200 response
   instead of waiting up to 5 minutes for the schedule.

## 11. Deploy

```powershell
npm run cf:deploy
```

This runs `opennextjs-cloudflare build` (a `next build` under the hood —
needs the build-time env from §5 present, i.e. run this from a shell/machine
with `.env.local` populated) then `opennextjs-cloudflare deploy`. To split
the steps (e.g. to inspect the build output before deploying):

```powershell
npm run cf:build
npx wrangler deploy
```

## 12. Rollback

Cloudflare Workers keeps deployment history automatically:

```powershell
npx wrangler deployments list
npx wrangler rollback [deployment-id]
```

Omitting `[deployment-id]` rolls back to the previous deployment. This is
instant (no rebuild) since it just repoints the Worker at a previously
uploaded version. Also available from the dashboard: Workers & Pages →
`velmaya` → Deployments tab → "..." on the target deployment → Rollback.

## 13. Post-deploy verification

```powershell
$env:VERIFY_BASE_URL = "https://<production-url-from-§3>"
npm run verify:cron
npm run verify:razorpay
npm run verify:email
```

These are the same self-cleaning scripts already used locally (they seed
and delete their own test rows against the real Supabase Production
database — nothing new to production data). Running them with
`VERIFY_BASE_URL` set points their HTTP calls (webhook, cron route) at the
deployed Worker instead of `localhost:3000`, so they need `.env.local`'s
`CRON_SECRET` / `RAZORPAY_WEBHOOK_SECRET` to match whatever you just set as
Worker secrets in §4, or the signature/auth checks will correctly reject
them. Also worth a quick manual smoke check:

```powershell
curl.exe -i https://<production-url>/
curl.exe -i -X POST https://<production-url>/api/cron/release-expired-reservations
```

The second call should return `401` with no `Authorization` header —
confirming the cron route is actually protected in production, not just in
local testing. For live log streaming during/after a deploy:

```powershell
npx wrangler tail
```

---

## Checklist

- [ ] `wrangler login` / `wrangler whoami` confirm the correct Cloudflare account
- [ ] `wrangler secret put` run for all 8 vars in §4
- [ ] `wrangler secret list` shows all 8 names
- [ ] Build-time `.env.local` has the vars listed in §5
- [ ] Resend domain verified (§8)
- [ ] `CRON_SECRET` matches between Worker secret and GitHub Actions secret
- [ ] `PRODUCTION_URL` GitHub Actions secret set (§9, §10)
- [ ] `npm run cf:deploy` succeeds
- [ ] `wrangler deployments list` shows the new deployment
- [ ] `curl` smoke test + `verify:cron`/`verify:razorpay`/`verify:email` against `VERIFY_BASE_URL` all pass
- [ ] Manually trigger the GitHub Actions workflow once to confirm end-to-end
