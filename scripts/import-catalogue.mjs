// Bulk catalogue import from CSV → Supabase. Lets non-technical edits happen in
// a spreadsheet instead of SQL. One row per VARIANT; product columns repeat
// across a product's size rows and are grouped by `slug`.
//
//   node --env-file=.env.local scripts/import-catalogue.mjs path/to/catalogue.csv
//   (or: npm run import:catalogue -- path/to/catalogue.csv)
//
// Columns (header row required):
//   slug,name,category_slug,collections,description,fabric,care_instructions,
//   base_price,size,sku,price,sale_price,stock_qty,is_published
// - collections: optional, semicolon-separated collection slugs (e.g. "launch-edit")
// - sale_price: blank = no sale
// - is_published: true/false (defaults true). Same value across a product's rows.
//
// Idempotent: upserts products by slug and variants by sku. Editing stock_qty
// here OVERWRITES current stock — for routine restocks prefer Supabase Studio.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const file = process.argv[2];
if (!URL || !SERVICE) { console.error("Missing Supabase env (.env.local)."); process.exit(2); }
if (!file) { console.error("Usage: import-catalogue.mjs <file.csv>"); process.exit(2); }

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

// Minimal CSV parser (handles quoted fields, commas, and "" escapes).
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

const titleCase = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

async function main() {
  const raw = readFileSync(file, "utf8");
  const rows = parseCSV(raw).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) throw new Error("CSV has no data rows");

  const header = rows[0].map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const required = ["slug", "name", "category_slug", "base_price", "size", "sku", "price", "stock_qty"];
  for (const col of required) if (!(col in idx)) throw new Error(`missing column: ${col}`);

  const get = (r, c) => (idx[c] != null ? (r[idx[c]] ?? "").trim() : "");
  const num = (v) => (v === "" ? null : Number(v));

  // Group rows by product slug.
  const groups = new Map();
  for (const r of rows.slice(1)) {
    const slug = get(r, "slug");
    if (!slug) continue;
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(r);
  }

  // Resolve categories + collections referenced (create-if-missing by slug).
  const catSlugs = new Set([...groups.values()].map((g) => get(g[0], "category_slug")));
  const colSlugs = new Set();
  for (const g of groups.values())
    get(g[0], "collections").split(";").map((s) => s.trim()).filter(Boolean).forEach((s) => colSlugs.add(s));

  const catId = {}, colId = {};
  for (const slug of catSlugs) {
    const { data, error } = await db.from("categories").upsert({ slug, name: titleCase(slug) }, { onConflict: "slug" }).select("id").single();
    if (error) throw new Error(`category ${slug}: ${error.message}`);
    catId[slug] = data.id;
  }
  for (const slug of colSlugs) {
    const { data, error } = await db.from("collections").upsert({ slug, name: titleCase(slug) }, { onConflict: "slug" }).select("id").single();
    if (error) throw new Error(`collection ${slug}: ${error.message}`);
    colId[slug] = data.id;
  }

  let pCount = 0, vCount = 0;
  for (const [slug, g] of groups) {
    const head = g[0];
    const isPub = (get(head, "is_published") || "true").toLowerCase() !== "false";
    const { data: prod, error: pErr } = await db.from("products").upsert({
      slug, name: get(head, "name"), description: get(head, "description") || null,
      category_id: catId[get(head, "category_slug")],
      fabric: get(head, "fabric") || null,
      care_instructions: get(head, "care_instructions") || null,
      base_price: num(get(head, "base_price")), is_published: isPub,
    }, { onConflict: "slug" }).select("id").single();
    if (pErr) throw new Error(`product ${slug}: ${pErr.message}`);
    pCount++;

    const variants = g.map((r) => ({
      product_id: prod.id, size: get(r, "size"), sku: get(r, "sku"),
      price: num(get(r, "price")), sale_price: num(get(r, "sale_price")),
      stock_qty: Number(get(r, "stock_qty") || 0),
    }));
    const { error: vErr } = await db.from("product_variants").upsert(variants, { onConflict: "sku" });
    if (vErr) throw new Error(`variants ${slug}: ${vErr.message}`);
    vCount += variants.length;

    const cols = get(head, "collections").split(";").map((s) => s.trim()).filter(Boolean);
    for (const cs of cols) {
      const { error } = await db.from("product_collections").upsert(
        { product_id: prod.id, collection_id: colId[cs] }, { onConflict: "product_id,collection_id", ignoreDuplicates: true });
      if (error) throw new Error(`link ${slug}/${cs}: ${error.message}`);
    }
  }

  console.log(`✓ imported ${pCount} product(s), ${vCount} variant(s) from ${file}`);
  console.log("  rebuild the site (or wait for ISR) to publish catalogue changes.");
}

main().catch((e) => { console.error("import failed:", e.message); process.exit(1); });
