// Pre-import safety check for a real-catalogue CSV (see
// docs/15-real-catalogue-onboarding-plan.md). Read-only: only ever SELECTs
// from Supabase (to check for slug/SKU collisions against what's actually
// live) and only ever READS local image files — never writes, never
// imports, never deletes anything.
//
//   node --env-file=.env.local scripts/verify-catalogue.mjs <csv-path> [images-dir]
//   (or: npm run verify:catalogue -- <csv-path> [images-dir])
//
// - <csv-path>: the catalogue CSV to check (see docs/catalogue-real-launch-template.csv)
// - [images-dir]: optional path to the local photo staging root (see docs/15 §5).
//   If omitted, image-file-existence checks are skipped with a note — the
//   rest of the checks still run.
// - Supabase env vars are optional here: if NEXT_PUBLIC_SUPABASE_URL /
//   SUPABASE_SERVICE_ROLE_KEY aren't set, the live-collision check is
//   skipped with a note rather than failing — this script is usable purely
//   offline against a CSV.
//
// Exit code 0 = no blocking errors (warnings may still be present, read them).
// Exit code 1 = at least one blocking error found.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const VALID_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];
const VALID_SHOT_TYPES = [
  "front",
  "back",
  "side",
  "fabric_closeup",
  "detail_closeup",
  "lifestyle",
];
const KNOWN_CATEGORIES = ["kurtis", "kurti-sets", "short-kurtis", "co-ord-sets"];
const CAT_CODE = { kurtis: "K", "kurti-sets": "KS", "short-kurtis": "SK", "co-ord-sets": "CO" };
// The 12 demo products currently live in Supabase Production (seed-catalogue.mjs) —
// a real-catalogue CSV must never reuse any of these slugs.
const KNOWN_DEMO_SLUGS = new Set([
  "rosewood-cotton-kurti",
  "indigo-block-print-kurti",
  "saffron-a-line-kurti",
  "fern-mul-cotton-kurti",
  "clay-kurti-pant-set",
  "ivory-embroidered-kurti-set",
  "olive-cotton-kurti-set",
  "blush-short-kurti",
  "charcoal-short-kurti",
  "marigold-short-kurti",
  "terracotta-coord-set",
  "sand-print-coord-set",
]);
const SKU_PATTERN = /^VLM-(K|KS|SK|CO)-(\d{3})-(XS|S|M|L|XL|2XL)$/;

const csvPath = process.argv[2];
const imagesDir = process.argv[3];
if (!csvPath) {
  console.error("Usage: verify-catalogue.mjs <csv-path> [images-dir]");
  process.exit(2);
}

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// Same minimal CSV parser as import-catalogue.mjs (handles quoted fields,
// commas, "" escapes) — kept self-contained rather than shared, matching
// this project's existing script style.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Parses the CSV into { slug -> { product fields, variants: [{size, sku, price, salePrice, stockQty}], imageList } }.
function parseCatalogue(rows) {
  const header = rows[0].map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const required = ["slug", "name", "category_slug", "base_price", "size", "sku", "price", "stock_qty"];
  const missingCols = required.filter((c) => !(c in idx));
  if (missingCols.length) {
    err(`Missing required column(s): ${missingCols.join(", ")}`);
    return null;
  }

  const get = (r, c) => (idx[c] != null ? (r[idx[c]] ?? "").trim() : "");
  const groups = new Map();

  for (const r of rows.slice(1)) {
    const slug = get(r, "slug");
    if (!slug) { err("Row with a blank slug found — every row needs one"); continue; }
    if (!groups.has(slug)) {
      groups.set(slug, {
        name: get(r, "name"),
        category: get(r, "category_slug"),
        basePrice: get(r, "base_price"),
        description: get(r, "description"),
        fabric: get(r, "fabric"),
        care: get(r, "care_instructions"),
        isPublished: (get(r, "is_published") || "true").toLowerCase() !== "false",
        imageList: get(r, "image_filenames").split(";").map((s) => s.trim()).filter(Boolean),
        fieldConsistency: [],
        variants: [],
      });
    }
    const g = groups.get(slug);
    g.fieldConsistency.push({
      name: get(r, "name"),
      category: get(r, "category_slug"),
      basePrice: get(r, "base_price"),
      description: get(r, "description"),
      fabric: get(r, "fabric"),
      care: get(r, "care_instructions"),
      isPublished: get(r, "is_published"),
    });
    g.variants.push({
      size: get(r, "size"),
      sku: get(r, "sku"),
      price: get(r, "price"),
      salePrice: get(r, "sale_price"),
      stockQty: get(r, "stock_qty"),
    });
  }
  return groups;
}

function validate(groups) {
  const allSkus = new Map(); // sku -> slug, to catch in-CSV duplicates
  const nextSeqSeen = {}; // category code -> highest sequence number seen in this CSV

  for (const [slug, product] of groups) {
    if (KNOWN_DEMO_SLUGS.has(slug)) {
      err(`[${slug}] reuses a DEMO product's slug — this would overwrite live demo data. Choose a different slug.`);
    }

    for (const field of ["name", "category", "basePrice", "description", "fabric", "care", "isPublished"]) {
      const values = new Set(product.fieldConsistency.map((r) => r[field]));
      if (values.size > 1) {
        err(`[${slug}] "${field}" differs across its size rows (${[...values].join(" / ")}) — product-level columns must be identical across a product's rows`);
      }
    }

    if (!product.name) err(`[${slug}] missing name`);
    if (!product.category) err(`[${slug}] missing category_slug`);
    else if (!KNOWN_CATEGORIES.includes(product.category)) {
      warn(`[${slug}] category_slug "${product.category}" isn't one of the known categories (${KNOWN_CATEGORIES.join(", ")}) — if that's intentional (a new category), ignore this; otherwise check for a typo`);
    }
    const basePriceNum = Number(product.basePrice);
    if (product.basePrice === "" || Number.isNaN(basePriceNum) || basePriceNum <= 0) {
      err(`[${slug}] invalid base_price: "${product.basePrice}"`);
    }
    if (!product.description) warn(`[${slug}] missing description`);
    if (!product.fabric) warn(`[${slug}] missing fabric`);
    if (!product.care) warn(`[${slug}] missing care_instructions`);

    if (product.isPublished) {
      warn(`[${slug}] is_published is not "false" — per the draft-first workflow (docs/15 §8), new products should import as drafts and be flipped to published only after review`);
    }

    // ── Images ──────────────────────────────────────────────────────────
    if (product.imageList.length === 0) {
      if (product.isPublished) err(`[${slug}] no images listed in image_filenames, but is_published is not false`);
      else warn(`[${slug}] no images listed in image_filenames yet`);
    } else if (product.imageList.length < 3) {
      warn(`[${slug}] only ${product.imageList.length} image(s) listed — 3+ (front/back + one detail) recommended`);
    }
    for (const filename of product.imageList) {
      const m = filename.match(/^(\d{2})-([a-z_]+)\.webp$/);
      if (!m) {
        err(`[${slug}] image filename "${filename}" doesn't match the "NN-shot_type.webp" convention (docs/15 §5)`);
        continue;
      }
      const shotType = m[2];
      if (!VALID_SHOT_TYPES.includes(shotType)) {
        err(`[${slug}] image "${filename}" has shot type "${shotType}", not one of: ${VALID_SHOT_TYPES.join(", ")}`);
      }
      if (imagesDir) {
        const fullPath = path.join(imagesDir, slug, filename);
        if (!existsSync(fullPath)) {
          err(`[${slug}] missing image file: ${fullPath}`);
        }
      }
    }
    if (!imagesDir && product.imageList.length > 0) {
      warn(`[${slug}] image_filenames listed but no images-dir argument given — skipped checking the files actually exist on disk`);
    }

    // ── Variants (sizes) ───────────────────────────────────────────────
    const sizesSeen = new Set();
    let anyStock = false;
    for (const v of product.variants) {
      if (!VALID_SIZES.includes(v.size)) {
        err(`[${slug}] invalid size "${v.size}" — must be one of ${VALID_SIZES.join(", ")}`);
      } else if (sizesSeen.has(v.size)) {
        err(`[${slug}] duplicate row for size "${v.size}"`);
      } else {
        sizesSeen.add(v.size);
      }

      if (!v.sku) {
        err(`[${slug}/${v.size}] missing sku`);
      } else {
        if (allSkus.has(v.sku) && allSkus.get(v.sku) !== slug) {
          err(`SKU "${v.sku}" is used by both "${allSkus.get(v.sku)}" and "${slug}" — duplicate SKU within this CSV`);
        }
        allSkus.set(v.sku, slug);
        const skuMatch = v.sku.match(SKU_PATTERN);
        if (!skuMatch) {
          warn(`[${slug}/${v.size}] SKU "${v.sku}" doesn't match the VLM-{CAT}-{SEQ}-{SIZE} convention (docs/15 §3)`);
        } else {
          const [, catCode, seq] = skuMatch;
          nextSeqSeen[catCode] = Math.max(nextSeqSeen[catCode] || 0, Number(seq));
          const expectedCat = CAT_CODE[product.category];
          if (expectedCat && catCode !== expectedCat) {
            err(`[${slug}/${v.size}] SKU "${v.sku}" uses category code "${catCode}" but the product's category is "${product.category}" (expected "${expectedCat}")`);
          }
        }
      }

      const priceNum = Number(v.price);
      if (v.price === "" || Number.isNaN(priceNum) || priceNum <= 0) {
        err(`[${slug}/${v.size}] invalid price: "${v.price}"`);
      }
      if (v.salePrice !== "") {
        const saleNum = Number(v.salePrice);
        if (Number.isNaN(saleNum) || saleNum <= 0) {
          err(`[${slug}/${v.size}] invalid sale_price: "${v.salePrice}"`);
        } else if (!Number.isNaN(priceNum) && saleNum >= priceNum) {
          err(`[${slug}/${v.size}] sale_price (${saleNum}) is not lower than price (${priceNum})`);
        }
      }
      const stockNum = Number(v.stockQty);
      if (v.stockQty === "" || !Number.isInteger(stockNum) || stockNum < 0) {
        err(`[${slug}/${v.size}] invalid stock_qty: "${v.stockQty}"`);
      } else if (stockNum > 0) {
        anyStock = true;
      }
    }

    const missingSizes = VALID_SIZES.filter((s) => !sizesSeen.has(s));
    if (missingSizes.length > 0) {
      warn(`[${slug}] missing size(s): ${missingSizes.join(", ")} — confirm this is deliberate, not an oversight`);
    }
    if (product.variants.length > 0 && !anyStock) {
      warn(`[${slug}] every listed size has 0 stock — nothing will be purchasable`);
    }
  }

  return { allSkus, nextSeqSeen };
}

async function checkLive(groups, allSkus) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SERVICE) {
    warn("Supabase env not found (.env.local) — skipped the live collision check against production. Re-run with env available before the real import.");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: existingProducts, error: pErr } = await db.from("products").select("slug");
  if (pErr) { warn(`Live check skipped — couldn't read products: ${pErr.message}`); return; }
  const existingSlugs = new Set(existingProducts.map((p) => p.slug));

  const { data: existingVariants, error: vErr } = await db
    .from("product_variants")
    .select("sku, products(slug)");
  if (vErr) { warn(`Live check skipped — couldn't read product_variants: ${vErr.message}`); return; }
  const existingSkuToSlug = new Map(
    existingVariants.map((v) => [v.sku, v.products?.slug ?? "(unknown product)"])
  );

  for (const slug of groups.keys()) {
    if (existingSlugs.has(slug) && !KNOWN_DEMO_SLUGS.has(slug)) {
      warn(`[${slug}] already exists in Supabase — this import will UPDATE it, not create a new product. Confirm that's intended.`);
    }
  }
  for (const [sku, slug] of allSkus) {
    const owner = existingSkuToSlug.get(sku);
    if (owner && owner !== slug) {
      err(`SKU "${sku}" already exists in Supabase belonging to "${owner}", but this CSV assigns it to "${slug}" — importing would silently re-parent that variant. Choose a different SKU.`);
    }
  }

  console.log(`Live check: compared against ${existingSlugs.size} existing product(s), ${existingSkuToSlug.size} existing SKU(s) in Supabase.`);
}

function report(nextSeqSeen) {
  console.log("");
  console.log("  Velmaya — catalogue CSV verification");
  console.log("  ──────────────────────────────────────────────");
  if (errors.length === 0 && warnings.length === 0) {
    console.log("  No issues found.");
  }
  for (const w of warnings) console.log(`  WARN   ${w}`);
  for (const e of errors) console.log(`  ERROR  ${e}`);
  console.log("  ──────────────────────────────────────────────");
  if (nextSeqSeen && Object.keys(nextSeqSeen).length) {
    console.log("  Next free SKU sequence per category seen in this CSV:");
    for (const [cat, max] of Object.entries(nextSeqSeen)) {
      console.log(`    ${cat}: ${String(max + 1).padStart(3, "0")}`);
    }
  }
  console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length > 0) {
    console.log("  ✗ FAIL — fix the errors above before importing");
    process.exit(1);
  } else {
    console.log("  ✓ PASS — no blocking errors (review any warnings above)");
    process.exit(0);
  }
}

async function main() {
  if (!existsSync(csvPath)) {
    err(`CSV file not found: ${csvPath}`);
    return report();
  }
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCSV(raw).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    err("CSV has no data rows");
    return report();
  }

  const groups = parseCatalogue(rows);
  if (!groups) return report();

  const totalVariants = [...groups.values()].reduce((n, p) => n + p.variants.length, 0);
  console.log(`Parsed ${groups.size} product(s), ${totalVariants} variant row(s) from ${csvPath}.`);

  const { allSkus, nextSeqSeen } = validate(groups);
  await checkLive(groups, allSkus);
  report(nextSeqSeen);
}

main();
