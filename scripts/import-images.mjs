// Bulk image import: uploads staged product photos to Cloudflare R2 and
// writes the matching product_images rows. Implements the convention from
// docs/15-real-catalogue-onboarding-plan.md §5/§6.
//
//   node --env-file=.env.local scripts/import-images.mjs <csv-path> <staging-dir> [--dry-run]
//   (or: npm run import:images -- <csv-path> <staging-dir> [--dry-run])
//
// - <csv-path>: the same catalogue CSV used with import-catalogue.mjs (reads
//   its `slug` and `image_filenames` columns; see docs/catalogue-real-launch-template.csv).
// - <staging-dir>: local root containing catalogue-staging/{slug}/{seq}-{shot_type}.webp
//   per product (docs/15 §5).
// - --dry-run: validates everything (local files, product lookups) and
//   prints the exact plan, but performs NO upload and NO database write.
//   Safe to run at any time, including before R2 is configured.
//
// Requires the product to already exist in Supabase (run import-catalogue.mjs
// first). For each product processed in live mode, this DELETES that
// product's existing product_images rows and replaces them with the fresh
// set from the CSV — a full replace, not an append. Re-running is therefore
// safe/idempotent for that product, but only ever touches the products
// actually listed in the CSV.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const VALID_SHOT_TYPES = [
  "front",
  "back",
  "side",
  "fabric_closeup",
  "detail_closeup",
  "lifestyle",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((a) => !a.startsWith("--"));
const csvPath = positional[0];
const stagingDir = positional[1];

if (!csvPath || !stagingDir) {
  console.error("Usage: import-images.mjs <csv-path> <staging-dir> [--dry-run]");
  process.exit(2);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Missing Supabase env (.env.local).");
  process.exit(2);
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
const r2Configured = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_BASE_URL);

if (!dryRun && !r2Configured) {
  console.error(
    "R2 is not configured (.env.local is missing one or more of R2_ACCOUNT_ID, " +
      "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL). " +
      "Run with --dry-run to validate without R2, or set up R2 first (docs/15 §1.1)."
  );
  process.exit(2);
}

// Same minimal CSV parser as import-catalogue.mjs / verify-catalogue.mjs.
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

function main() {
  if (!existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(2);
  }
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCSV(raw).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    console.error("CSV has no data rows");
    process.exit(2);
  }

  const header = rows[0].map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const col of ["slug", "name", "image_filenames"]) {
    if (!(col in idx)) {
      console.error(`Missing required column: ${col}`);
      process.exit(2);
    }
  }
  const get = (r, c) => (idx[c] != null ? (r[idx[c]] ?? "").trim() : "");

  // One entry per product (first row per slug carries the product-level fields).
  const products = new Map();
  for (const r of rows.slice(1)) {
    const slug = get(r, "slug");
    if (!slug || products.has(slug)) continue;
    products.set(slug, {
      name: get(r, "name"),
      imageList: get(r, "image_filenames").split(";").map((s) => s.trim()).filter(Boolean),
    });
  }

  return run(products);
}

async function run(products) {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

  let r2 = null;
  if (!dryRun) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    r2 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }

  console.log("");
  console.log(`  Velmaya — image import ${dryRun ? "(DRY RUN — no upload, no writes)" : "(LIVE)"}`);
  console.log("  ──────────────────────────────────────────────");

  let productsOk = 0, productsSkipped = 0, imagesPlanned = 0, imagesUploaded = 0;

  for (const [slug, product] of products) {
    if (product.imageList.length === 0) {
      console.log(`  SKIP   [${slug}] no image_filenames listed`);
      productsSkipped++;
      continue;
    }

    const { data: dbProduct, error: findErr } = await db
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (findErr) {
      console.log(`  ERROR  [${slug}] Supabase lookup failed: ${findErr.message}`);
      productsSkipped++;
      continue;
    }
    if (!dbProduct) {
      console.log(`  SKIP   [${slug}] no product with this slug in Supabase yet — run import-catalogue.mjs first`);
      productsSkipped++;
      continue;
    }

    const planned = [];
    let productHasError = false;
    for (const filename of product.imageList) {
      const m = filename.match(/^(\d{2})-([a-z_]+)\.webp$/);
      if (!m) {
        console.log(`  ERROR  [${slug}] "${filename}" doesn't match the NN-shot_type.webp convention`);
        productHasError = true;
        continue;
      }
      const [, seq, shotType] = m;
      if (!VALID_SHOT_TYPES.includes(shotType)) {
        console.log(`  ERROR  [${slug}] "${filename}" has unrecognized shot type "${shotType}"`);
        productHasError = true;
        continue;
      }
      const localPath = path.join(stagingDir, slug, filename);
      if (!existsSync(localPath)) {
        console.log(`  ERROR  [${slug}] missing local file: ${localPath}`);
        productHasError = true;
        continue;
      }
      const r2Key = `products/${slug}/${filename}`;
      planned.push({
        localPath,
        r2Key,
        displayOrder: Number(seq),
        shotType,
        altText: `${product.name}, ${shotType.replace(/_/g, " ")}`,
      });
    }

    if (productHasError) {
      console.log(`  SKIP   [${slug}] fix the errors above before this product's images can be imported`);
      productsSkipped++;
      continue;
    }

    imagesPlanned += planned.length;

    if (dryRun) {
      console.log(`  PLAN   [${slug}] would upload+insert ${planned.length} image(s):`);
      for (const p of planned) {
        console.log(`           ${p.displayOrder}. ${p.r2Key}  (${p.shotType}, alt: "${p.altText}")`);
      }
      productsOk++;
      continue;
    }

    // Live: upload each file, then replace this product's image rows.
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      for (const p of planned) {
        const body = readFileSync(p.localPath);
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: p.r2Key,
          Body: body,
          ContentType: "image/webp",
        }));
        imagesUploaded++;
      }

      const { error: delErr } = await db.from("product_images").delete().eq("product_id", dbProduct.id);
      if (delErr) throw new Error(`clearing old image rows failed: ${delErr.message}`);

      const rowsToInsert = planned.map((p) => ({
        product_id: dbProduct.id,
        r2_url: `${R2_PUBLIC_BASE_URL}/${p.r2Key}`,
        alt_text: p.altText,
        shot_type: p.shotType,
        display_order: p.displayOrder,
      }));
      const { error: insErr } = await db.from("product_images").insert(rowsToInsert);
      if (insErr) throw new Error(`inserting image rows failed: ${insErr.message}`);

      console.log(`  OK     [${slug}] uploaded + linked ${planned.length} image(s)`);
      productsOk++;
    } catch (e) {
      console.log(`  ERROR  [${slug}] ${e.message}`);
      productsSkipped++;
    }
  }

  console.log("  ──────────────────────────────────────────────");
  console.log(`  ${productsOk} product(s) ${dryRun ? "planned" : "imported"}, ${productsSkipped} skipped/errored`);
  console.log(`  ${imagesPlanned} image(s) planned${dryRun ? "" : `, ${imagesUploaded} uploaded`}`);
  // process.exitCode (not process.exit()) — lets Node drain any still-closing
  // async handles from the Supabase/R2 clients naturally instead of forcing
  // an abrupt exit, which was crashing on Windows (libuv assertion in
  // src/win/async.c) when handles were mid-close at exit() time.
  process.exitCode = productsSkipped > 0 ? 1 : 0;
}

main();
