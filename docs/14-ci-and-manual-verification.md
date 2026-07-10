# CI scope and manual verification (H6)

Addresses `docs/12-launch-readiness-audit.md` **H6**: no CI/CD and no
automated test suite for a payment-processing system. This is deliberately
a **minimal, launch-safe gate**, not a full test suite — see below for what's
in `.github/workflows/ci.yml` and, more importantly, what's intentionally
left as manual and why.

---

## What CI runs (every PR and every push to `main`)

1. `npm ci`
2. `npm run lint`
3. `npm run build`

No Supabase, Razorpay, Resend, or cron secrets are configured for this job —
none are needed. `src/lib/products/queries.ts`'s `supabaseConfigured()` check
falls back to the bundled mock catalogue (`src/lib/products/seed.ts`) when
`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` aren't set, so
`next build`'s static generation (`product/[slug]`, `shop/[category]`)
succeeds fully offline. Confirmed by building locally with `.env.local`
removed before writing the workflow — same 35 routes, same result as with
real credentials.

There's no separate `typecheck` script in `package.json` today — `next
build` already runs a full TypeScript check as part of its own pipeline
(visible in its own output as "Linting and checking validity of types"), so
a standalone `tsc --noEmit` step would only repeat that work. If a dedicated
`typecheck` script is added later, add it as its own CI step before `build`
so it fails fast.

This gate catches: syntax errors, type errors, lint violations (including
unused vars, hook-rule violations, etc. per `eslint.config.mjs`), and
anything that would break the production build — on every PR, with zero
secrets exposed to any contributor's branch or fork.

## What's intentionally NOT in CI

| Script | Why it stays manual |
|---|---|
| `verify:supabase`, `verify:retry`, `verify:rate-limit` | Write real rows to the **actual Supabase Production database** — there is no separate staging/test Supabase project (per `docs/08-supabase-setup-and-verification.md`, local dev already points at production). Self-cleaning by design, but running them automatically on every push/PR would mean untrusted branches mutate production data, and would require putting `SUPABASE_SERVICE_ROLE_KEY` into GitHub Actions where any PR (including from forks) can trigger a workflow run against it — a real credential-exposure risk, not just noise. |
| `verify:razorpay`, `verify:email` | Same production-database concern, plus they call **live third-party APIs** (Razorpay test-mode, Resend) and require a running server (`VERIFY_BASE_URL`) — not something to fire on every CI run without real API keys in Actions secrets, and third-party rate limits would make PR-frequency runs unreliable. |
| `verify:cron` | Same as above — also specifically exercises the `CRON_SECRET`-protected route; putting that secret in a PR-triggered workflow defeats its purpose. |
| `verify:journey` | Broader end-to-end smoke test over the same production Supabase data — same exposure concern. |
| `reconcile:payments`, `seed:catalogue`, `import:catalogue` | Operational/maintenance scripts, not verification — write or reconcile real catalogue/order data. Never appropriate to run unattended in CI. |

**The common thread:** every one of these needs either the Supabase
service-role key or a live third-party API key, and every one of them
writes to the one real Supabase Production database. Putting any of them in
CI means putting production-grade secrets somewhere every contributor's
pull request can reach — that's a bigger risk than the coverage gap it
would close. A proper fix would be a dedicated CI/staging Supabase project
(and possibly Razorpay/Resend sandbox accounts) with its own scoped
secrets — worth doing, but out of scope for this minimal H6 pass.

## Manual verification — when and how

Run the full gate from `docs/13-production-deployment-cloudflare.md` §13
locally (or against a deployed preview via `VERIFY_BASE_URL`) before merging
any change that touches checkout, payment, inventory, or email code:

```powershell
npm run verify:supabase
npm run verify:retry
npm run verify:rate-limit
npm run verify:razorpay   # needs the dev server running
npm run verify:email      # needs the dev server running
npm run verify:cron       # needs the dev server running
npm run build
```

This is the same sequence already used to validate the H1–H5 fixes and the
H4 runbook. Treat it as a pre-merge checklist for payment/inventory-touching
PRs until a dedicated CI Supabase project makes automating it safe.
