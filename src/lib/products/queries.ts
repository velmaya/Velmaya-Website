import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sizes, type Size } from "@/lib/site-config";
import type { Product, ProductVariant, ProductImage } from "./types";
import { seedProducts } from "./seed";

// Catalogue data access. When Supabase is configured we read the real catalogue
// from the database; otherwise (offline dev) we fall back to the mock seed. UI
// components depend only on the returned Product shape, never on the source.
//
// server-only: these functions use the service-role client and must never be
// imported into a client component. Client-safe helpers/types live in ./types
// (re-exported from ./index).

function supabaseConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const sizeOrder = (s: string) => sizes.indexOf(s as Size);

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  fabric: string | null;
  care_instructions: string | null;
  base_price: number;
  categories: { slug: string } | null;
  product_variants: {
    id: string;
    size: string;
    sku: string;
    price: number;
    sale_price: number | null;
    stock_qty: number;
  }[];
  product_images: {
    r2_url: string;
    alt_text: string | null;
    shot_type: string | null;
    display_order: number;
  }[];
  product_collections: { collections: { slug: string } | null }[];
};

function mapRow(row: Row): Product {
  const variants: ProductVariant[] = [...row.product_variants]
    .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size))
    .map((v) => ({
      id: v.id,
      size: v.size as Size,
      sku: v.sku,
      price: Number(v.price),
      salePrice: v.sale_price == null ? null : Number(v.sale_price),
      stockQty: v.stock_qty,
    }));

  const images: ProductImage[] = [...(row.product_images ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((i) => ({
      url: i.r2_url || undefined,
      alt: i.alt_text ?? row.name,
      shotType: (i.shot_type ?? undefined) as ProductImage["shotType"],
    }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    categorySlug: row.categories?.slug ?? "",
    collectionSlugs: (row.product_collections ?? [])
      .map((pc) => pc.collections?.slug)
      .filter((s): s is string => !!s),
    fabric: row.fabric ?? "",
    careInstructions: row.care_instructions ?? "",
    basePrice: Number(row.base_price),
    images,
    variants,
  };
}

const SELECT = `
  id, slug, name, description, fabric, care_instructions, base_price,
  categories ( slug ),
  product_variants ( id, size, sku, price, sale_price, stock_qty ),
  product_images ( r2_url, alt_text, shot_type, display_order ),
  product_collections ( collections ( slug ) )
`;

export async function getAllProducts(): Promise<Product[]> {
  if (!supabaseConfigured()) return seedProducts;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getAllProducts: ${error.message}`);
  return (data as unknown as Row[]).map(mapRow);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await getAllProducts();
  return all.find((p) => p.slug === slug) ?? null;
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

export async function getRelatedProducts(
  product: Product,
  limit = 4
): Promise<Product[]> {
  const all = await getAllProducts();
  return all
    .filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug)
    .slice(0, limit);
}

export async function getAllProductSlugs(): Promise<string[]> {
  const all = await getAllProducts();
  return all.map((p) => p.slug);
}
