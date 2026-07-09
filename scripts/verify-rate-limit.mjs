// HIGH-5 — basic rate limiting verification.
//
// Calls the check_rate_limit() RPC directly (checkRateLimit() in
// src/lib/rate-limit/index.ts is a thin wrapper around it, and can't be
// invoked from a plain Node script — same reason other verify scripts test
// the underlying RPC/route rather than a "use server" action directly).
//
// Run:  node --env-file=.env.local scripts/verify-rate-limit.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE],
].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Missing in .env.local: " + missing.join(", "));
  process.exit(2);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results = [];
const pass = (n, d = "") => results.push({ ok: true, n, d });
const fail = (n, d = "") => results.push({ ok: false, n, d });

const KEY = `zzz-ratelimit-${Date.now()}`;

async function check(max, windowSeconds = 300) {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: KEY,
    p_window_seconds: windowSeconds,
    p_max_requests: max,
  });
  if (error) throw error;
  return data;
}

async function main() {
  const max = 5;

  const outcomes = [];
  for (let i = 0; i < max; i++) outcomes.push(await check(max));
  if (outcomes.every((o) => o === true))
    pass("Under the limit", `${max}/${max} calls allowed`);
  else fail("Under the limit", `expected all true, got ${JSON.stringify(outcomes)}`);

  const over1 = await check(max);
  const over2 = await check(max);
  if (over1 === false && over2 === false)
    pass("Over the limit", "6th and 7th calls rejected");
  else fail("Over the limit", `expected false, false — got ${over1}, ${over2}`);

  // A different key is an independent bucket — must not be affected by the
  // above key's usage.
  const otherKey = `${KEY}-other`;
  const { data: otherOk, error: otherErr } = await admin.rpc("check_rate_limit", {
    p_key: otherKey, p_window_seconds: 300, p_max_requests: 1,
  });
  if (!otherErr && otherOk === true)
    pass("Independent keys", "a different key is not affected by another key's count");
  else fail("Independent keys", `error=${otherErr?.message}, ok=${otherOk}`);

  // Cleanup query check: rows for this test key should exist right now.
  const { data: rows } = await admin.from("rate_limits").select("key").like("key", `${KEY}%`);
  if ((rows ?? []).length > 0) pass("Rows persisted", `${rows.length} row(s) for this test`);
  else fail("Rows persisted", "expected at least one row");
}

async function cleanup() {
  await admin.from("rate_limits").delete().like("key", `${KEY}%`);
}

function report() {
  console.log("\n  Velmaya — Rate limiting verification\n  " + "─".repeat(46));
  for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.n}${r.d ? `  — ${r.d}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log("  " + "─".repeat(46));
  console.log(`  ${results.length - failed}/${results.length} checks passed` + (failed ? `  (${failed} FAILED)` : "  ✓ all green"));
  return failed;
}

let code = 0;
try { await main(); }
catch (e) { fail("Unexpected error", e instanceof Error ? e.message : String(e)); }
finally { try { await cleanup(); } catch { /* best effort */ } code = report() > 0 ? 1 : 0; }
process.exit(code);
