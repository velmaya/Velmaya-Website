// Configuration-driven commerce settings — never hardcode shipping values.
// Env-backed with sensible defaults; can later move behind a `store_settings`
// table without changing callers (see docs/06 §3a).

function num(value: string | undefined, fallback: number): number {
  const n = value != null ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const commerceConfig = {
  currency: "INR",
  /** Subtotal at/above which shipping is free. */
  freeShippingThreshold: num(
    process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD,
    1499
  ),
  /** Flat fee charged when below the free-shipping threshold. */
  flatShippingFee: num(process.env.NEXT_PUBLIC_SHIPPING_FLAT_FEE, 79),
} as const;

/** Server/client-safe shipping fee for a given subtotal (₹). */
export function computeShippingFee(subtotal: number): number {
  return subtotal >= commerceConfig.freeShippingThreshold
    ? 0
    : commerceConfig.flatShippingFee;
}

/** Amount still needed to unlock free shipping (0 if already free). */
export function freeShippingRemaining(subtotal: number): number {
  return Math.max(0, commerceConfig.freeShippingThreshold - subtotal);
}
