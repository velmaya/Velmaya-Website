import "server-only";

// Minimal Resend REST client via fetch — mirrors razorpay/client.ts: avoids an
// SDK dependency, since plain fetch is what's proven predictable under
// Cloudflare Workers (nodejs_compat) for this project.

const RESEND_API_BASE = "https://api.resend.com";

export function resendConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM!,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ id: string }>;
}
