# Stage 3.6 — Razorpay Test-Mode Payment Verification (runbook)

Goal: one real browser checkout end-to-end in **Test Mode**, with Razorpay
delivering a live webhook to the local app via a tunnel, then verify every
payment table and reconcile. **No real money** — test cards only.

---

## 1. Razorpay test keys

Razorpay Dashboard → toggle **Test Mode** (top bar) → **Settings → API Keys →
Generate Test Key**. Add to `.env.local`:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
```

## 2. Start the dev server (with the new keys)

```
npm run dev
```
Next reads env at startup, so **restart dev whenever you edit `.env.local`**.

## 3. Start a tunnel to localhost:3000

**cloudflared (no account needed):**
```
winget install --id Cloudflare.cloudflared      # one-time install
cloudflared tunnel --url http://localhost:3000
```
Copy the printed `https://<random>.trycloudflare.com` URL.

> The quick-tunnel URL changes each time you restart cloudflared. If you restart
> it, update the Razorpay webhook URL (step 4) to match.

(ngrok alternative: `ngrok http 3000` after adding your authtoken.)

## 4. Register the Razorpay test webhook

Dashboard (Test Mode) → **Settings → Webhooks → Add New Webhook**:
- **URL:** `https://<random>.trycloudflare.com/api/webhooks/razorpay`
- **Secret:** create a strong random string. Put the **same** value in `.env.local`:
  ```
  RAZORPAY_WEBHOOK_SECRET=<that-secret>
  ```
- **Active events:** `payment.captured`, `payment.failed` (optionally `order.paid`)
- Save. Then **restart `npm run dev`** so it picks up the webhook secret.

## 5. Tell me "ready"

I will then:
1. Run `npm run verify:razorpay` — exercises the webhook route directly
   (signature → idempotency → finalize/release) with a temp order. Self-cleaning.
2. Guide you through **one real browser checkout** on `http://localhost:3000`:
   shop → add to bag → checkout → shipping → **Pay** → Razorpay test card
   `4111 1111 1111 1111`, any future expiry, any CVV.
3. Inspect the full lifecycle for that order:
   `payment_attempts`, `orders` (`status` + `payment_status`),
   `inventory_reservations`, `inventory_movements`, `webhook_events`.
4. Run `npm run reconcile:payments` and confirm **no discrepancies**.

---

## Test instruments (Razorpay test mode)
- **Success card:** `4111 1111 1111 1111`, future expiry, any CVV, any name.
- **Failure:** use Razorpay's documented failure test card to verify the
  `payment.failed` → stock-release path.
- UPI test: `success@razorpay`.

## Gotchas
- Restart `npm run dev` after any `.env.local` change.
- Webhook secret must match exactly between Razorpay and `.env.local`.
- Browse on `localhost:3000` (fine); the tunnel is only for Razorpay → webhook.
- `placeOrder` requires Razorpay configured **and** a real DB variant — both true
  once keys are set and the catalogue is seeded (done in Stage 3.5).
