import { createHmac } from "node:crypto";

// Razorpay's checkout flow returns order_id + payment_id + signature on success.
// The signature is HMAC-SHA256("{order_id}|{payment_id}", key_secret) — verifying
// it server-side is what proves the payment actually succeeded (never trust the
// client-side success callback alone).
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return expected === params.signature;
}
