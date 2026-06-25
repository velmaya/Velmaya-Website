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

  return timingSafeEqualHex(expected, params.signature);
}

// Webhook signature: HMAC-SHA256(rawBody, webhook_secret). The raw, unparsed
// request body must be used — re-serialising JSON would change the bytes and
// break the signature. This is the authoritative proof a webhook is from Razorpay.
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string | null;
}) {
  if (!params.signature) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(params.rawBody)
    .digest("hex");

  return timingSafeEqualHex(expected, params.signature);
}

// Constant-time hex compare to avoid timing side-channels on signature checks.
function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
