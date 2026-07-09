import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Sweeps expired inventory holds (see release_expired_reservations() in
// 20260625120000_m5_orders.sql) and cancels their still-unpaid orders.
// Protected by CRON_SECRET so only the scheduled job can call it — see
// .github/workflows/release-expired-reservations.yml and
// docs/12-launch-readiness-audit.md (H1).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("release_expired_reservations");

  if (error) {
    console.error("release-expired-reservations: rpc failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ released: data ?? 0 });
}

// Constant-time compare to avoid a timing side-channel on the cron secret
// (same reasoning as razorpay/verify.ts's signature comparison).
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
