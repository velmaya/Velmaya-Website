# Stage 4 — Email Notifications (Resend)

Two transactional emails fire when an order is finalized as paid: a **customer
order confirmation** and an **internal store notification**. Built per
[`06-milestone-5-plan.md`](06-milestone-5-plan.md) §9.

## Architecture

- **`src/lib/email/client.ts`** — minimal Resend REST client via `fetch`
  (mirrors `razorpay/client.ts`: no SDK dependency, since plain fetch is what's
  proven predictable under Cloudflare Workers `nodejs_compat` for this project).
- **`src/lib/email/templates/`** — hand-rolled, table-based HTML with inline
  styles (email clients don't support external stylesheets or most modern CSS).
  Brand colors match `globals.css`'s light theme (email always renders light).
  Each template also returns a plain-text fallback.
- **`src/lib/email/order-emails.ts`** — `sendOrderConfirmationEmails(db, orderId)`
  loads the order + items + customer, renders both templates, and sends them.
- **`src/lib/orders/finalize.ts`** — `finalizeOrderPaid` is the **only** call
  site. It's invoked by both the Razorpay webhook and the browser's
  `confirmPayment` callback (whichever wins the race), so embedding the email
  trigger there — rather than in the webhook route or the browser action —
  guarantees emails fire from one single, server-verified place, never
  directly from unverified client data.

## Idempotency

Webhooks retry, and the webhook + browser callback can both call
`finalizeOrderPaid` for the same order. Exactly-once sending is guaranteed by
an atomic conditional update, not a check-then-act:

```sql
update orders set confirmation_email_sent_at = now()
where id = $1 and confirmation_email_sent_at is null
```

Only the caller whose `UPDATE` actually matches a row (i.e. flips it from
`null`) proceeds to send; every other caller — concurrent or a later retry —
matches zero rows and skips. This is the same pattern `webhook_events`' primary
key uses for webhook idempotency, applied here via a single-row conditional
update instead of an insert conflict.

## Failure isolation

`sendOrderConfirmationEmails` never throws. `finalizeOrderPaid` wraps the call
in `try/catch` as well (defense in depth). A Resend outage, a bad address, or
any other email failure is logged to the console and otherwise invisible to
the payment flow — the order is already `paid` by the time email is attempted.

If `RESEND_API_KEY`/`EMAIL_FROM` aren't configured, sending is skipped up front
(logged, not claimed) — `confirmation_email_sent_at` stays `null`, which
accurately reflects that no email was ever attempted for that order.

## Environment variables

| Var | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key (server-only) |
| `EMAIL_FROM` | Verified sender address — **read from env only, never hardcoded**, so it can move from a sandbox sender to a verified domain address without a code change |
| `SHOP_NOTIFICATION_EMAIL` | Where the internal "new order" email goes |

**Sandbox sender note:** until `velmaya.com` is DNS-verified in the Resend
dashboard (Domains), `EMAIL_FROM` must be Resend's sandbox address
`onboarding@resend.dev` — Resend rejects sends from unverified custom domains.
In sandbox mode, Resend only actually delivers to the email address on the
Resend account itself. Once the domain is verified, change `EMAIL_FROM` to the
real address (e.g. `orders@velmaya.com`) in `.env.local` and restart — no code
change needed.

## Verification

```
npm run verify:email [your-email@example.com]
```

Seeds a temporary order, posts a real `payment.captured` event to the local
webhook route (exercising the actual `finalizeOrderPaid` → email path), and
checks:
- `confirmation_email_sent_at` gets set on a captured payment (when Resend is
  configured), or stays `null` gracefully (when it isn't).
- Replaying the same webhook event does **not** re-send (timestamp unchanged).

Pass your own email as an argument to receive a real customer-confirmation
send (useful while `EMAIL_FROM` is still the sandbox address, since only the
Resend account's own email can receive test sends). Cleans up all seeded data
on exit, like the other `verify:*` scripts.

## Known limitation

Real customer emails won't deliver until `velmaya.com` is verified in Resend
(sandbox mode restricts recipients to the Resend account owner's own address).
Until then, live checkouts will silently skip the customer email in production
too if `EMAIL_FROM` is left on the sandbox address and the customer's address
differs from the Resend account owner's — the internal notification will
still work once `SHOP_NOTIFICATION_EMAIL` matches that same restriction, or
once the domain is verified, both emails work for any recipient.
