import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/razorpay/verify";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const valid = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  return NextResponse.json({ valid });
}
