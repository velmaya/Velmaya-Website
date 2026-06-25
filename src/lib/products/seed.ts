import type { Product, ProductVariant } from "./types";
import { sizes, type Size } from "@/lib/site-config";

// Mock catalogue used until Supabase is configured. Placeholder images (no url)
// render the branded placeholder; swap in R2 urls later with no UI change.
// Stock is intentionally varied (some sizes at 0) to exercise the variant UI.

function variants(
  skuBase: string,
  price: number,
  stockBySize: Partial<Record<Size, number>>,
  salePrice?: number
): ProductVariant[] {
  return sizes.map((size) => ({
    id: `${skuBase}-${size}`,
    size,
    sku: `${skuBase}-${size}`,
    price,
    salePrice: salePrice ?? null,
    stockQty: stockBySize[size] ?? 0,
  }));
}

const full = { XS: 6, S: 10, M: 12, L: 9, XL: 7, "2XL": 4 } as const;
const lowSizes = { XS: 0, S: 3, M: 5, L: 4, XL: 0, "2XL": 2 } as const;

export const seedProducts: Product[] = [
  // ── Kurtis ──────────────────────────────────────────────
  {
    id: "p-rosewood-kurti",
    slug: "rosewood-cotton-kurti",
    name: "Rosewood Cotton Kurti",
    description:
      "An everyday straight-cut kurti in breathable cotton, with a soft mandarin collar and wood-tone buttons. Cut for easy movement from desk to evening.",
    categorySlug: "kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "100% cotton",
    careInstructions: "Machine wash cold, gentle cycle. Do not bleach.",
    basePrice: 1299,
    images: [
      { alt: "Rosewood Cotton Kurti, front", shotType: "front" },
      { alt: "Rosewood Cotton Kurti, back", shotType: "back" },
      { alt: "Rosewood Cotton Kurti, fabric detail", shotType: "fabric_closeup" },
    ],
    variants: variants("VLM-K-ROSE", 1299, full),
  },
  {
    id: "p-indigo-kurti",
    slug: "indigo-block-print-kurti",
    name: "Indigo Block-Print Kurti",
    description:
      "Hand-feel block print in deep indigo on a relaxed A-line silhouette. A quiet statement piece that pairs with everything.",
    categorySlug: "kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "Cotton-linen blend",
    careInstructions: "Hand wash separately in cold water. Dry in shade.",
    basePrice: 1499,
    images: [
      { alt: "Indigo Block-Print Kurti, front", shotType: "front" },
      { alt: "Indigo Block-Print Kurti, lifestyle", shotType: "lifestyle" },
    ],
    variants: variants("VLM-K-INDI", 1499, full),
  },
  {
    id: "p-saffron-kurti",
    slug: "saffron-a-line-kurti",
    name: "Saffron A-Line Kurti",
    description:
      "A warm saffron A-line with subtle thread detailing at the yoke. Lightweight and forgiving, made for long days.",
    categorySlug: "kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "Rayon",
    careInstructions: "Machine wash cold. Warm iron if needed.",
    basePrice: 1199,
    images: [
      { alt: "Saffron A-Line Kurti, front", shotType: "front" },
      { alt: "Saffron A-Line Kurti, detail", shotType: "detail_closeup" },
    ],
    variants: variants("VLM-K-SAFF", 1199, lowSizes, 999),
  },
  {
    id: "p-fern-kurti",
    slug: "fern-mul-cotton-kurti",
    name: "Fern Mul Cotton Kurti",
    description:
      "Soft mul cotton in a fern green, with a gentle drape and side slits. The kind of kurti you reach for without thinking.",
    categorySlug: "kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "Mul cotton",
    careInstructions: "Hand wash cold. Line dry.",
    basePrice: 1099,
    images: [{ alt: "Fern Mul Cotton Kurti, front", shotType: "front" }],
    variants: variants("VLM-K-FERN", 1099, full),
  },

  // ── Kurti Sets ─────────────────────────────────────────
  {
    id: "p-clay-kurti-set",
    slug: "clay-kurti-pant-set",
    name: "Clay Kurti & Pant Set",
    description:
      "A coordinated kurti and tapered pant in a warm clay tone. Considered tailoring that looks pulled-together with zero effort.",
    categorySlug: "kurti-sets",
    collectionSlugs: ["launch-edit"],
    fabric: "Cotton blend",
    careInstructions: "Machine wash cold, gentle. Do not tumble dry.",
    basePrice: 2299,
    images: [
      { alt: "Clay Kurti & Pant Set, front", shotType: "front" },
      { alt: "Clay Kurti & Pant Set, back", shotType: "back" },
    ],
    variants: variants("VLM-KS-CLAY", 2299, full),
  },
  {
    id: "p-ivory-kurti-set",
    slug: "ivory-embroidered-kurti-set",
    name: "Ivory Embroidered Kurti Set",
    description:
      "Delicate tonal embroidery on an ivory kurti, paired with matching straight pants. Understated enough for day, special enough for evening.",
    categorySlug: "kurti-sets",
    collectionSlugs: ["launch-edit"],
    fabric: "Chanderi-blend",
    careInstructions: "Dry clean recommended.",
    basePrice: 2799,
    images: [
      { alt: "Ivory Embroidered Kurti Set, front", shotType: "front" },
      { alt: "Ivory Embroidered Kurti Set, detail", shotType: "detail_closeup" },
    ],
    variants: variants("VLM-KS-IVOR", 2799, lowSizes),
  },
  {
    id: "p-olive-kurti-set",
    slug: "olive-cotton-kurti-set",
    name: "Olive Cotton Kurti Set",
    description:
      "An easy olive kurti with a coordinated palazzo. All-day cotton comfort in a colour that flatters every skin tone.",
    categorySlug: "kurti-sets",
    collectionSlugs: ["launch-edit"],
    fabric: "100% cotton",
    careInstructions: "Machine wash cold. Warm iron.",
    basePrice: 2199,
    images: [{ alt: "Olive Cotton Kurti Set, front", shotType: "front" }],
    variants: variants("VLM-KS-OLIV", 2199, full),
  },

  // ── Short Kurtis ───────────────────────────────────────
  {
    id: "p-blush-short-kurti",
    slug: "blush-short-kurti",
    name: "Blush Short Kurti",
    description:
      "A hip-length short kurti in soft blush, designed to wear with jeans or palazzos. Modern length, classic ease.",
    categorySlug: "short-kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "Rayon",
    careInstructions: "Machine wash cold. Do not bleach.",
    basePrice: 899,
    images: [
      { alt: "Blush Short Kurti, front", shotType: "front" },
      { alt: "Blush Short Kurti, side", shotType: "side" },
    ],
    variants: variants("VLM-SK-BLSH", 899, full),
  },
  {
    id: "p-charcoal-short-kurti",
    slug: "charcoal-short-kurti",
    name: "Charcoal Short Kurti",
    description:
      "A versatile charcoal short kurti with a clean round neck. The kind of layering piece that earns its place in every week.",
    categorySlug: "short-kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "Cotton-viscose",
    careInstructions: "Machine wash cold. Line dry.",
    basePrice: 949,
    images: [{ alt: "Charcoal Short Kurti, front", shotType: "front" }],
    variants: variants("VLM-SK-CHAR", 949, full, 799),
  },
  {
    id: "p-marigold-short-kurti",
    slug: "marigold-short-kurti",
    name: "Marigold Short Kurti",
    description:
      "A cheerful marigold short kurti with tie-up sleeves. Bright, light, and made for warm afternoons.",
    categorySlug: "short-kurtis",
    collectionSlugs: ["launch-edit"],
    fabric: "Rayon",
    careInstructions: "Hand wash cold. Dry in shade.",
    basePrice: 899,
    images: [{ alt: "Marigold Short Kurti, front", shotType: "front" }],
    variants: variants("VLM-SK-MARI", 899, lowSizes),
  },

  // ── Co-ord Sets ────────────────────────────────────────
  {
    id: "p-terracotta-coord",
    slug: "terracotta-coord-set",
    name: "Terracotta Co-ord Set",
    description:
      "A relaxed terracotta co-ord — a boxy top and wide-leg trouser cut from the same soft weave. Matched so you don't have to.",
    categorySlug: "co-ord-sets",
    collectionSlugs: ["launch-edit"],
    fabric: "Cotton-linen blend",
    careInstructions: "Machine wash cold, gentle. Cool iron.",
    basePrice: 2499,
    images: [
      { alt: "Terracotta Co-ord Set, front", shotType: "front" },
      { alt: "Terracotta Co-ord Set, lifestyle", shotType: "lifestyle" },
    ],
    variants: variants("VLM-CO-TERR", 2499, full),
  },
  {
    id: "p-sand-coord",
    slug: "sand-print-coord-set",
    name: "Sand Print Co-ord Set",
    description:
      "A tonal sand print co-ord with a tie-waist trouser. Effortless from morning coffee to evening out.",
    categorySlug: "co-ord-sets",
    collectionSlugs: ["launch-edit"],
    fabric: "Viscose",
    careInstructions: "Dry clean or gentle hand wash.",
    basePrice: 2599,
    images: [{ alt: "Sand Print Co-ord Set, front", shotType: "front" }],
    variants: variants("VLM-CO-SAND", 2599, full, 2199),
  },
];
