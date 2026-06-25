# Velmaya — Payment & Order State Machine

Companion to [`06-milestone-5-plan.md`](06-milestone-5-plan.md). This is the
authoritative reference for every state and transition in checkout, payment, and
inventory. Implementation must conform to these diagrams.

There are **four** related state machines, kept deliberately separate:

1. **Order lifecycle** — `orders.status`
2. **Order payment outcome** — `orders.payment_status` (rolls up the attempts)
3. **Payment attempt** — `payment_attempts.status` (one row per Razorpay try)
4. **Inventory reservation** — `inventory_reservations.status`

---

## 1. Order lifecycle — `orders.status`

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
  create ─▶ pending_payment ──payment captured──▶ paid ──ship──▶ fulfilled
                    │  │                            │
                    │  │                            └──refund──▶ refunded
                    │  └── payment.failed ─────────▶ payment_failed
                    │                                     │
                    │                                retry succeeds
                    │                                     ▼
                    │                                   paid
                    └── expiry / user cancel ─────▶ cancelled
```

| State | Meaning | Entered by |
|---|---|---|
| `pending_payment` | order created, awaiting payment | checkout create-order |
| `paid` | payment captured & verified | webhook `payment.captured` |
| `payment_failed` | latest attempt failed (retry still possible) | webhook `payment.failed` |
| `cancelled` | reservation expired or user/ops cancelled | expiry cron / cancel |
| `fulfilled` | shipped (ops action, later milestone) | ops |
| `refunded` | refunded after payment | webhook `refund.processed` |

Notes:
- `payment_failed → paid` is allowed (a later attempt on the same order succeeds)
  **while the reservation is still alive**. Once the reservation expires, the order
  goes `cancelled` and the shopper must re-checkout.

---

## 2. Payment outcome — `orders.payment_status`

Rolls up `payment_attempts`. Always reflects the **most advanced** attempt.

```
created ──▶ authorized ──▶ captured ──refund──▶ refunded
   │            │
   └─────┬──────┘
         ▼
       failed ──(retry)──▶ created … (new attempt)
```

| State | Source event |
|---|---|
| `created` | Razorpay order created for the (first/next) attempt |
| `authorized` | `payment.authorized` (auth-only; capture pending) |
| `captured` | `payment.captured` — money settled → order `paid` |
| `failed` | `payment.failed` — order `payment_failed` |
| `refunded` | `refund.processed` |

---

## 3. Payment attempt — `payment_attempts.status`

One **order** → many **attempts** (retry after decline). Each attempt maps to one
Razorpay order/payment try.

```
created ──▶ authorized ──▶ captured        (terminal: success)
   │            │
   └────────────┴──▶ failed                (terminal: failure; a NEW row starts a retry)
```

- A new attempt row is inserted on each retry; `error_code` / `error_description`
  are stored on failure for support/debugging.
- The order's `payment_status` = the best status across its attempts.

---

## 4. Inventory reservation — `inventory_reservations.status`

```
   reserve_stock()
        │
        ▼
      held ──confirm_reservations() [payment captured]──▶ confirmed
        │
        ├── release_reservations() [payment.failed]      ──▶ released
        ├── release_reservations() [user/ops cancel]     ──▶ released
        └── release_expired_reservations() [expires_at]  ──▶ released
```

| Transition | `stock_qty` | movement (`inventory_movements.reason`) |
|---|---|---|
| → `held` | unchanged | `RESERVATION` (−qty) |
| `held → confirmed` | **−qty** | `SALE` (−qty) |
| `held → released` | unchanged | `RESERVATION_RELEASE` (+qty) |

`available = stock_qty − Σ held`. See `06-…` §3 for the full model. Confirm and
release are **idempotent** (safe under webhook retries).

---

## 5. End-to-end flows

### 5.1 Success (happy path)
```
cart → checkout → create-order
  order=pending_payment, payment_status=created
  reservation=held, movement=RESERVATION(−)
  payment_attempt#1=created, razorpay order created
→ Razorpay Checkout (test) → success
→ /verify (UX): signature ok → optimistic "confirmed" redirect
→ webhook payment.captured (authoritative, idempotent):
     attempt#1=captured, payment_status=captured
     reservation held→confirmed, stock_qty−=qty, movement=SALE(−)
     order=paid
     confirmation email (guarded by confirmation_email_sent_at)
     confirmation page shows order # + WhatsApp link
```

### 5.2 Failure (declined, retry)
```
create-order → held / attempt#1=created
→ Razorpay → declined
→ webhook payment.failed:
     attempt#1=failed (error_code stored)
     payment_status=failed, order=payment_failed
     reservation NOT released yet (hold still alive within 15 min)
→ user retries → attempt#2=created (new Razorpay order if needed)
→ success → webhook payment.captured → as 5.1 (order=paid)
```
> Design choice: on `payment.failed` we keep the hold so an immediate retry
> doesn't lose the size. The hold is released by expiry if the retry never lands.
> (If we instead release on first failure, document and flip the cron/webhook.)

### 5.3 Expiry (abandoned checkout)
```
create-order → held, expires_at = now()+15m
→ user never pays
→ release_expired_reservations() (cron):
     reservation held→released, movement=RESERVATION_RELEASE(+)
     order pending_payment→cancelled
```

### 5.4 Cancellation (explicit)
```
user/ops cancels a pending_payment order
→ release_reservations(order_id): held→released, movement=RESERVATION_RELEASE(+)
→ order=cancelled
```

### 5.5 Webhook flow (authoritative finalizer)
```
POST /api/webhooks/razorpay
  1. verify HMAC(raw_body, RAZORPAY_WEBHOOK_SECRET)         — else 400
  2. idempotency: insert event_id into webhook_events       — conflict → 200 skip
  3. switch(event.type):
       payment.authorized → attempt=authorized, payment_status=authorized
       payment.captured   → confirm_reservations, order=paid, payment_status=captured, email
       payment.failed     → attempt=failed, payment_status=failed, order=payment_failed
       refund.processed   → payment_status=refunded, order=refunded   (later)
  4. 200 (ack) on handled/duplicate so Razorpay stops retrying
```

### 5.6 Race: webhook vs browser callback
Both call the **same idempotent** `confirm_reservations`/finalize. Whichever
arrives first finalizes; the second is a no-op. If the browser callback is lost
(tab closed), the webhook still finalizes. The confirmation page polls
`orders.status` and shows "processing" until it flips to `paid`.

---

## 6. Idempotency & safety summary

- **Webhook**: deduped via `webhook_events.event_id` (primary key).
- **Confirm/Release**: status-guarded (`held → …` only); re-running is a no-op.
- **Stock**: decremented exactly once (at confirm), via `SELECT … FOR UPDATE`.
- **Email**: guarded by `orders.confirmation_email_sent_at`; never blocks the order.
- **Amounts**: always recomputed server-side; client values are display-only.
