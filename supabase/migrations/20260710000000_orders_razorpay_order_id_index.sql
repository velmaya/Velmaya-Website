-- Additive: index orders.razorpay_order_id.
--
-- src/app/api/webhooks/razorpay/route.ts queries this column directly on
-- every single Razorpay webhook delivery (`.eq("razorpay_order_id", ...)`),
-- but it was never indexed — payment_attempts got both its order_id and
-- razorpay_order_id indexes in the M5 migration, orders itself was missed.
-- See docs/12-launch-readiness-audit.md (H4/H5).

create index if not exists orders_razorpay_order_id_idx
  on orders(razorpay_order_id);
