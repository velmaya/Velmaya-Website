-- Milestone 5 — Orders & checkout (additive migration).
-- Safe to apply on top of 20260624000000_init_schema.sql: only ADDs columns,
-- tables, and functions; the one constraint swap targets a table with no rows yet.
-- See docs/06-milestone-5-plan.md and docs/07-payment-order-state-machine.md.

-- ───────────────────────── orders: payment + optional fields ─────────────────
alter table orders
  add column if not exists payment_status text not null default 'created'
    check (payment_status in ('created','authorized','captured','failed','refunded')),
  add column if not exists order_notes text,
  add column if not exists gift_message text,
  add column if not exists confirmation_email_sent_at timestamptz;

-- Human-friendly order numbers (VLM-001000, …) via a sequence default, so the
-- app never has to generate or risk colliding on order_number.
create sequence if not exists order_number_seq start 1000;
alter table orders
  alter column order_number set default 'VLM-' || lpad(nextval('order_number_seq')::text, 6, '0');

-- ───────────────────────── payment_attempts ─────────────────────────────────
-- One order can have multiple Razorpay attempts (retry after a decline).
-- The latest terminal attempt drives orders.payment_status.
create table if not exists payment_attempts (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  razorpay_order_id text,
  razorpay_payment_id text,
  status text not null default 'created'
    check (status in ('created','authorized','captured','failed')),
  amount numeric(10,2) not null,
  method text,
  error_code text,
  error_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_attempts_order_id_idx on payment_attempts(order_id);
create index if not exists payment_attempts_rzp_order_idx on payment_attempts(razorpay_order_id);

-- ───────────────────────── webhook_events (idempotency) ─────────────────────
create table if not exists webhook_events (
  event_id text primary key,          -- Razorpay event id; PK gives idempotency
  type text not null,
  order_id uuid references orders(id),
  payload jsonb,
  received_at timestamptz not null default now()
);

-- ───────────────────────── inventory_movements: reasons ─────────────────────
-- Expand to the approved event set. No rows exist yet, so dropping/recreating
-- the check constraint is safe.
alter table inventory_movements
  drop constraint if exists inventory_movements_reason_check;
alter table inventory_movements
  add constraint inventory_movements_reason_check
  check (reason in ('SALE','RESERVATION','RESERVATION_RELEASE','RESTOCK','MANUAL_ADJUSTMENT','REFUND'));

-- ───────────────────────── inventory RPC functions ─────────────────────────
-- Availability model: stock_qty = physical on-hand; availability subtracts only
-- 'held' reservations. stock_qty is decremented at CONFIRM (payment captured),
-- not at reserve, so a released hold never needs a stock correction.

-- Reserve atomically across all lines; raise if any line lacks availability.
-- p_items: jsonb array of { "variant_id": uuid, "qty": int }.
create or replace function reserve_stock(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
as $$
declare
  item jsonb;
  v_variant uuid;
  v_qty int;
  v_available int;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_variant := (item->>'variant_id')::uuid;
    v_qty := (item->>'qty')::int;

    select pv.stock_qty
         - coalesce((select sum(ir.quantity) from inventory_reservations ir
                      where ir.variant_id = v_variant and ir.status = 'held'), 0)
      into v_available
      from product_variants pv
     where pv.id = v_variant
     for update;  -- lock the variant row to serialise concurrent checkouts

    if v_available is null then
      raise exception 'variant_not_found:%', v_variant;
    end if;
    if v_available < v_qty then
      raise exception 'insufficient_stock:%', v_variant using errcode = '23514';
    end if;

    insert into inventory_reservations(order_id, variant_id, quantity, status, expires_at)
      values (p_order_id, v_variant, v_qty, 'held', now() + interval '15 minutes');

    insert into inventory_movements(variant_id, change_qty, reason, order_id)
      values (v_variant, -v_qty, 'RESERVATION', p_order_id);
  end loop;
end;
$$;

-- Confirm all held reservations for an order (payment captured). Idempotent.
create or replace function confirm_reservations(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in select * from inventory_reservations
            where order_id = p_order_id and status = 'held'
  loop
    update product_variants
       set stock_qty = stock_qty - r.quantity
     where id = r.variant_id;

    update inventory_reservations set status = 'confirmed' where id = r.id;

    insert into inventory_movements(variant_id, change_qty, reason, order_id)
      values (r.variant_id, -r.quantity, 'SALE', p_order_id);
  end loop;
end;
$$;

-- Release all held reservations for an order (failed / cancelled). Idempotent.
create or replace function release_reservations(p_order_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in select * from inventory_reservations
            where order_id = p_order_id and status = 'held'
  loop
    update inventory_reservations set status = 'released' where id = r.id;

    insert into inventory_movements(variant_id, change_qty, reason, order_id)
      values (r.variant_id, r.quantity, 'RESERVATION_RELEASE', p_order_id);
  end loop;
end;
$$;

-- Sweep expired held reservations; release stock and cancel still-unpaid orders.
-- Called by the cleanup cron (protected by CRON_SECRET). Returns count released.
create or replace function release_expired_reservations()
returns int
language plpgsql
as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from inventory_reservations
            where status = 'held' and expires_at < now()
  loop
    update inventory_reservations set status = 'released' where id = r.id;
    insert into inventory_movements(variant_id, change_qty, reason, order_id)
      values (r.variant_id, r.quantity, 'RESERVATION_RELEASE', r.order_id);
    update orders set status = 'cancelled', updated_at = now()
      where id = r.order_id and status = 'pending_payment';
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ───────────────────────── RLS (deny anon; service role bypasses) ───────────
-- These tables are written only by server routes/actions via the service-role
-- client (which bypasses RLS). Enabling RLS with no policies denies anon access.
alter table orders                  enable row level security;
alter table order_items             enable row level security;
alter table customers               enable row level security;
alter table checkout_sessions       enable row level security;
alter table inventory_reservations  enable row level security;
alter table inventory_movements     enable row level security;
alter table payment_attempts        enable row level security;
alter table webhook_events          enable row level security;
