import type { Size } from "@/lib/site-config";

// Domain types mirroring docs/03-database-schema.sql. The data layer returns
// these whether the source is the mock seed (now) or Supabase (once configured),
// so UI components never depend on the source.

export type ProductImage = {
  url?: string; // R2 URL; undefined → branded placeholder rendered
  alt: string;
  shotType?:
    | "front"
    | "back"
    | "side"
    | "fabric_closeup"
    | "detail_closeup"
    | "lifestyle";
};

export type ProductVariant = {
  id: string;
  size: Size;
  sku: string;
  price: number;
  salePrice?: number | null;
  stockQty: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  collectionSlugs: string[];
  fabric: string;
  careInstructions: string;
  basePrice: number;
  images: ProductImage[];
  variants: ProductVariant[];
};

// Convenience derivations used across cards/PDP.
export function priceRange(product: Product) {
  const prices = product.variants.map((v) => v.salePrice ?? v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
}

export function effectivePrice(variant: ProductVariant) {
  return variant.salePrice ?? variant.price;
}

export function isOnSale(product: Product) {
  return product.variants.some(
    (v) => v.salePrice != null && v.salePrice < v.price
  );
}

export function totalStock(product: Product) {
  return product.variants.reduce((sum, v) => sum + v.stockQty, 0);
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
