import "server-only";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function clientIp() {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Fixed-window rate limit keyed by client IP + a named bucket, backed by the
// check_rate_limit() Postgres function (20260710010000_rate_limits.sql).
// Fails OPEN (allows the request) if the check itself errors — this is abuse
// deterrence for a revenue-path action, not a security boundary, and a
// transient Supabase hiccup here shouldn't be a new way to block real
// checkouts (the subsequent writes in the same action would fail anyway if
// Supabase were genuinely down).
export async function checkRateLimit(
  bucket: string,
  opts: { windowSeconds: number; max: number }
): Promise<boolean> {
  const ip = await clientIp();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: `${bucket}:${ip}`,
    p_window_seconds: opts.windowSeconds,
    p_max_requests: opts.max,
  });

  if (error) {
    console.error("checkRateLimit: rpc failed, failing open", bucket, error);
    return true;
  }
  return data === true;
}
