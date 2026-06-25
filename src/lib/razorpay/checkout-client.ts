// Browser-only helper to load and open Razorpay Checkout. Imported by the
// checkout client component. The key id is public (NEXT_PUBLIC_*); the secret
// never touches the browser.

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = { open: () => void };
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    document.body.appendChild(el);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(args: {
  razorpayOrderId: string;
  amountPaise: number;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (r: RazorpaySuccess) => void;
  onDismiss: () => void;
}): Promise<{ launched: boolean }> {
  const ok = await loadRazorpayScript();
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!ok || !key || !window.Razorpay) return { launched: false };

  const rzp = new window.Razorpay({
    key,
    order_id: args.razorpayOrderId,
    amount: args.amountPaise,
    currency: "INR",
    name: "Velmaya",
    description: "Order payment",
    prefill: args.prefill,
    theme: { color: "#8a6a3a" },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss },
  });
  rzp.open();
  return { launched: true };
}
