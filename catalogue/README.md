# Catalogue workspace

Working folder for preparing the real Velmaya catalogue before it goes into
Supabase/R2. Nothing in this folder is read by the app itself — it's a
staging area for humans and for the `verify:catalogue` / `import:catalogue` /
`import:images` scripts. See `docs/15-real-catalogue-onboarding-plan.md` for
the full plan this workspace implements, and
`docs/catalogue-product-prep-checklist.md` for a per-product prep checklist.

```
catalogue/
  csv/       working catalogue CSV(s)
  images/    one folder per product, staged photos before R2 upload
  archive/   superseded CSVs / removed-product records (see "Archiving" below)
```

## Where to place images

Each product gets its own folder under `catalogue/images/`, named after the
product (a README.txt in each explains the expected filenames). The
project's importer (`scripts/import-images.mjs`) expects files named:

```
NN-shot_type.webp
```

- `NN` — two-digit display order (`01`, `02`, `03`, ...)
- `shot_type` — one of: `front`, `back`, `side`, `fabric_closeup`,
  `detail_closeup`, `lifestyle`
- Format: `.webp` specifically (convert from whatever the photographer
  delivers — JPG/PNG/HEIC — before staging here)

Example: `catalogue/images/mustard-jacquard-cotton-kurti-set/01-front.webp`

List the exact filenames you staged in that product's `image_filenames`
column in the CSV (semicolon-separated), e.g.:
`01-front.webp;02-back.webp;03-side.webp;04-fabric_closeup.webp`

## How to update `csv/velmaya-products.csv`

One row per **size**, grouped by `slug` (a product with 6 sizes = 6 rows
sharing the same slug). Product-level columns (`name`, `category_slug`,
`description`, `fabric`, `care_instructions`, `is_published`, etc.) must be
identical across all of a product's rows — `verify:catalogue` checks this.

Column reference — see `docs/catalogue-real-launch-template.csv` (blank) and
`docs/catalogue-real-launch-example.csv` (one fully filled-in product) for
the authoritative format. Key conventions (full detail in `docs/15` §1–5):

- **Slug**: lowercase, hyphenated, generated from the product name.
- **SKU**: `{PREFIX}-{CAT}-{SEQ}-{SIZE}`, where `CAT` is `K` (kurtis),
  `KS` (kurti-sets), `SK` (short-kurtis), or `CO` (co-ord-sets), and `SEQ`
  is a zero-padded 3-digit sequence number per category.
  `docs/15` and the existing example CSV use a `VLM-` prefix; the two
  starter products in this working CSV currently use `VEL-` instead — see
  the note in "Known open items" below before treating either as final.
- **Sizes**: must be exactly `XS`, `S`, `M`, `L`, `XL`, `2XL` (not `XXL`) —
  this is the site's actual size vocabulary everywhere else in the code.
- **New products should import as drafts**: `is_published` = `false` until
  reviewed and ready to go live (see Workflow below).
- Leave any column blank if the value isn't decided yet — `verify:catalogue`
  will tell you exactly what's still missing or invalid.

## Workflow

1. **Verify the catalogue** (read-only, safe to run anytime, checks for
   duplicate slugs/SKUs, invalid prices/stock, missing images, and — if
   Supabase env is available — collisions against what's already live):
   ```
   npm run verify:catalogue -- catalogue/csv/velmaya-products.csv catalogue/images
   ```
2. **Import the catalogue** (writes products/variants to Supabase — only
   after verification passes with no blocking errors):
   ```
   npm run import:catalogue -- catalogue/csv/velmaya-products.csv
   ```
3. **Upload images** (writes to R2 + Supabase `product_images` — dry-run
   first):
   ```
   npm run import:images -- catalogue/csv/velmaya-products.csv catalogue/images --dry-run
   npm run import:images -- catalogue/csv/velmaya-products.csv catalogue/images
   ```
4. **Verify the live site** — with the product still `is_published = false`,
   check it in a local preview / Supabase Studio before flipping it live.
   Only after that review should `is_published` be set to `true` (via
   Supabase Studio, or a follow-up CSV import) and the deploy verified in
   production per `docs/13-production-deployment-cloudflare.md` §13.

## Archiving

When a product CSV is superseded (re-exported with corrections, or a
product is retired), move the old version into `catalogue/archive/` rather
than deleting it, so there's a record of what changed. The demo/seed
catalogue itself is not touched by anything in this folder — see `docs/15`
§10 for when and how to archive the demo products, only after real products
are verified live.

## Known open items (from initial workspace setup)

- The two starter products in `csv/velmaya-products.csv` use a `VEL-`
  SKU prefix, which differs from the `VLM-` prefix used in `docs/15` and
  the existing example CSV. `verify:catalogue` will warn (not block) on
  this — confirm which prefix is actually intended before the real import.
- Their `price`/`base_price`/`sale_price` columns are intentionally blank
  (not yet decided) — `verify:catalogue` will report this as a blocking
  error until real prices are filled in. Expected at this draft stage.
- Their `image_filenames` columns are intentionally blank — no photos are
  staged yet. The `images/*/README.txt` guides list filenames in `.jpg`
  form as a rough shot list only; the actual importer needs `.webp` files
  named per the shot-type convention above.
