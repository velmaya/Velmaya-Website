import "server-only";
import { effectivePrice } from "@/lib/products";
import { getProductBySlug } from "@/lib/products/queries";
import { computeShippingFee } from "@/lib/commerce/config";
import type { CartItem } from "@/lib/cart/types";
import type { RepricedCart, RepricedLine } from "./schema";

// Server-side cart revalidation: re-fetch each line from the data layer (mock
// today, Supabase once configured) and recompute price/availability/totals.
// The client's prices are never trusted — these are authoritative.
export async function repriceCart(items: CartItem[]): Promise<RepricedCart> {
  const lines: RepricedLine[] = [];

  for (const item of items) {
    const product = await getProductBySlug(item.productSlug);
    const variant = product?.variants.find((v) => v.id === item.variantId);

    if (!product || !variant) {
      lines.push({
        variantId: item.variantId,
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        size: item.size,
        qty: 0,
        requestedQty: item.qty,
        unitPrice: item.unitPrice,
        previousUnitPrice: item.unitPrice,
        lineTotal: 0,
        available: 0,
        status: "unavailable",
      });
      continue;
    }

    const unitPrice = effectivePrice(variant);
    const available = variant.stockQty;
    const qty = Math.min(item.qty, available);

    let status: RepricedLine["status"] = "ok";
    if (available === 0) status = "unavailable";
    else if (qty < item.qty) status = "qty_reduced";
    else if (unitPrice !== item.unitPrice) status = "price_changed";

    lines.push({
      variantId: item.variantId,
      productId: product.id,
      productSlug: item.productSlug,
      productName: product.name,
      size: variant.size,
      qty,
      requestedQty: item.qty,
      unitPrice,
      previousUnitPrice: item.unitPrice,
      lineTotal: unitPrice * qty,
      available,
      status,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shippingFee = computeShippingFee(subtotal);
  const hasChanges = lines.some((l) => l.status !== "ok");
  const hasPurchasable = lines.some((l) => l.qty > 0);

  return {
    lines,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    hasChanges,
    hasPurchasable,
  };
}
