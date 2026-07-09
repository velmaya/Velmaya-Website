-- Basic rate limiting for public, sensitive server actions (checkout order
-- creation, payment confirmation) — see docs/12-launch-readiness-audit.md H3.
-- Fixed-window counter per (key, window bucket), atomic via a single
-- upsert + RETURNING so concurrent requests from the same caller can't race
-- past the limit. Deliberately NOT applied to the Razorpay webhook route —
-- that must always accept Razorpay's deliveries/retries.

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create index if not exists idx_rate_limits_window on rate_limits(window_start);

create or replace function check_rate_limit(
  p_key text, p_window_seconds int, p_max_requests int
) returns boolean
language plpgsql
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  -- Opportunistic cleanup, bounded by the index — keeps the table small
  -- without needing a separate cron job.
  delete from rate_limits where window_start < now() - interval '1 hour';

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into rate_limits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max_requests;
end;
$$;

alter table rate_limits enable row level security;
