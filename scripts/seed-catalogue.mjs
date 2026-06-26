// Seed the Velmaya catalogue into Supabase (categories, collection, products,
// variants). Idempotent: upserts by slug / sku, so re-running is safe (note: it
// resets variant stock_qty to the seed values — intended for the initial load).
//
//   node --env-file=.env.local scripts/seed-catalogue.mjs
//
// Product imagery is added later (real photography → Cloudflare R2); products
// with no image rows render the branded placeholder. This is the canonical
// initial catalogue; edit products in Supabase (or here + re-run) thereafter.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing Supabase env (.env.local).");
  process.exit(2);
}
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const FULL = { XS: 6, S: 10, M: 12, L: 9, XL: 7, "2XL": 4 };
const LOW = { XS: 0, S: 3, M: 5, L: 4, XL: 0, "2XL": 2 };

const categories = [
  { slug: "kurtis", name: "Kurtis" },
  { slug: "kurti-sets", name: "Kurti Sets" },
  { slug: "short-kurtis", name: "Short Kurtis" },
  { slug: "co-ord-sets", name: "Co-ord Sets" },
];

const products = [
  ["rosewood-cotton-kurti", "Rosewood Cotton Kurti", "kurtis", "An everyday straight-cut kurti in breathable cotton, with a soft mandarin collar and wood-tone buttons.", "100% cotton", "Machine wash cold, gentle cycle. Do not bleach.", 1299, "VLM-K-ROSE", FULL, null],
  ["indigo-block-print-kurti", "Indigo Block-Print Kurti", "kurtis", "Hand-feel block print in deep indigo on a relaxed A-line silhouette.", "Cotton-linen blend", "Hand wash separately in cold water. Dry in shade.", 1499, "VLM-K-INDI", FULL, null],
  ["saffron-a-line-kurti", "Saffron A-Line Kurti", "kurtis", "A warm saffron A-line with subtle thread detailing at the yoke.", "Rayon", "Machine wash cold. Warm iron if needed.", 1199, "VLM-K-SAFF", LOW, 999],
  ["fern-mul-cotton-kurti", "Fern Mul Cotton Kurti", "kurtis", "Soft mul cotton in a fern green, with a gentle drape and side slits.", "Mul cotton", "Hand wash cold. Line dry.", 1099, "VLM-K-FERN", FULL, null],
  ["clay-kurti-pant-set", "Clay Kurti & Pant Set", "kurti-sets", "A coordinated kurti and tapered pant in a warm clay tone.", "Cotton blend", "Machine wash cold, gentle. Do not tumble dry.", 2299, "VLM-KS-CLAY", FULL, null],
  ["ivory-embroidered-kurti-set", "Ivory Embroidered Kurti Set", "kurti-sets", "Delicate tonal embroidery on an ivory kurti, paired with matching straight pants.", "Chanderi-blend", "Dry clean recommended.", 2799, "VLM-KS-IVOR", LOW, null],
  ["olive-cotton-kurti-set", "Olive Cotton Kurti Set", "kurti-sets", "An easy olive kurti with a coordinated palazzo.", "100% cotton", "Machine wash cold. Warm iron.", 2199, "VLM-KS-OLIV", FULL, null],
  ["blush-short-kurti", "Blush Short Kurti", "short-kurtis", "A hip-length short kurti in soft blush, designed to wear with jeans or palazzos.", "Rayon", "Machine wash cold. Do not bleach.", 899, "VLM-SK-BLSH", FULL, null],
  ["charcoal-short-kurti", "Charcoal Short Kurti", "short-kurtis", "A versatile charcoal short kurti with a clean round neck.", "Cotton-viscose", "Machine wash cold. Line dry.", 949, "VLM-SK-CHAR", FULL, 799],
  ["marigold-short-kurti", "Marigold Short Kurti", "short-kurtis", "A cheerful marigold short kurti with tie-up sleeves.", "Rayon", "Hand wash cold. Dry in shade.", 899, "VLM-SK-MARI", LOW, null],
  ["terracotta-coord-set", "Terracotta Co-ord Set", "co-ord-sets", "A relaxed terracotta co-ord — a boxy top and wide-leg trouser cut from the same soft weave.", "Cotton-linen blend", "Machine wash cold, gentle. Cool iron.", 2499, "VLM-CO-TERR", FULL, null],
  ["sand-print-coord-set", "Sand Print Co-ord Set", "co-ord-sets", "A tonal sand print co-ord with a tie-waist trouser.", "Viscose", "Dry clean or gentle hand wash.", 2599, "VLM-CO-SAND", FULL, 2199],
];

async function main() {
  // 1. Categories
  const { data: cats, error: cErr } = await db
    .from("categories")
    .upsert(
      categories.map((c, i) => ({ slug: c.slug, name: c.name, sort_order: i })),
      { onConflict: "slug" }
    )
    .select("id, slug");
  if (cErr) throw cErr;
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  console.log(`categories: ${cats.length}`);

  // 2. Collection
  const { data: coll, error: colErr } = await db
    .from("collections")
    .upsert({ slug: "launch-edit", name: "The Launch Edit" }, { onConflict: "slug" })
    .select("id")
    .single();
  if (colErr) throw colErr;

  // 3. Products + variants + collection links
  let variantCount = 0;
  for (const [slug, name, cat, description, fabric, care, base, sku, stock, sale] of products) {
    const { data: prod, error: pErr } = await db
      .from("products")
      .upsert(
        {
          slug, name, description,
          category_id: catId[cat],
          fabric, care_instructions: care,
          base_price: base, is_published: true,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (pErr) throw new Error(`product ${slug}: ${pErr.message}`);

    const variants = SIZES.map((size) => ({
      product_id: prod.id,
      size,
      sku: `${sku}-${size}`,
      price: base,
      sale_price: sale,
      stock_qty: stock[size] ?? 0,
    }));
    const { error: vErr } = await db
      .from("product_variants")
      .upsert(variants, { onConflict: "sku" });
    if (vErr) throw new Error(`variants ${slug}: ${vErr.message}`);
    variantCount += variants.length;

    const { error: lErr } = await db
      .from("product_collections")
      .upsert(
        { product_id: prod.id, collection_id: coll.id },
        { onConflict: "product_id,collection_id", ignoreDuplicates: true }
      );
    if (lErr) throw new Error(`collection link ${slug}: ${lErr.message}`);
  }

  console.log(`products: ${products.length}`);
  console.log(`variants: ${variantCount}`);
  console.log("✓ catalogue seeded");
}

main().catch((e) => {
  console.error("seed failed:", e.message);
  process.exit(1);
});
