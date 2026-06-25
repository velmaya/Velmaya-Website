import { NextResponse } from "next/server";
import { createRazorpayOrder } from "@/lib/razorpay/client";

// Milestone 2 proof-of-concept only: confirms a server route on the Cloudflare
// Workers runtime can call out to Razorpay's API using env secrets. The real
// checkout flow (cart total, order row, inventory reservation) is built in
// Milestone 5 — this route is deliberately minimal and fixed-amount for testing.
export const runtime = "nodejs";

export async function POST() {
  try {
    const order = await createRazorpayOrder({
      amountPaise: 100, // ₹1.00 test amount
      receipt: `poc-${Date.now()}`,
    });
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
