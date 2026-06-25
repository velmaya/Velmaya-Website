// Minimal Razorpay REST client via fetch — avoids the official axios-based SDK,
// which is less predictable under Cloudflare Workers (nodejs_compat) than a
// plain fetch call. Expand this file (refunds, webhooks) in Milestone 5.

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function authHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
}

export async function createRazorpayOrder(params: {
  amountPaise: number;
  currency?: string;
  receipt: string;
}) {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency ?? "INR",
      receipt: params.receipt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order creation failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ id: string; amount: number; currency: string }>;
}
