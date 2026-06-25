import type { Size } from "@/lib/site-config";

// A cart line item. Display-only fields are denormalised so the cart renders
// without a network call; price/stock are re-validated server-side at checkout
// (see docs/06 §1).
export type CartItem = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  size: Size;
  unitPrice: number; // effective (sale) price at time of adding
  imageUrl?: string; // R2 url, or undefined → branded placeholder
  imageAlt: string;
  qty: number;
};

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
