import type { Product } from "./types";
import { seedProducts } from "./seed";

export * from "./types";

// Data-access layer. Today it serves the mock seed; once Supabase env vars are
// present we switch to live queries here WITHOUT touching any UI component.
// All functions are async so the Supabase swap is a drop-in.

function supabaseConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// NOTE: when supabaseConfigured() becomes true, implement the Supabase branch
// in each function (select products + variants + images, map to Product type).
// Until then we return seed data. Kept intentionally simple and synchronous
// under the hood; the async signatures are the stable contract for the UI.

export async function getAllProducts(): Promise<Product[]> {
  if (supabaseConfigured()) {
    // TODO(milestone-5+): query Supabase. Falls through to seed until then.
  }
  return seedProducts;
}

export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  const all = await getAllProducts();
  return all.filter((p) => p.categorySlug === categorySlug);
}

export async function getProductsByCollection(
  collectionSlug: string
): Promise<Product[]> {
  const all = await getAllProducts();
  return all.filter((p) => p.collectionSlugs.includes(collectionSlug));
}

export async function getProductBySlug(
  slug: string
): Promise<Product | null> {
  const all = await getAllProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getRelatedProducts(
  product: Product,
  limit = 4
): Promise<Product[]> {
  const all = await getAllProducts();
  return all
    .filter(
      (p) => p.id !== product.id && p.categorySlug === product.categorySlug
    )
    .slice(0, limit);
}

export async function getAllProductSlugs(): Promise<string[]> {
  const all = await getAllProducts();
  return all.map((p) => p.slug);
}
