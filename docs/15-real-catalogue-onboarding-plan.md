# Real Catalogue Onboarding Plan — Demo → ~100 Launch Products

**Status: PLAN ONLY.** Nothing in this document has been imported, deleted,
or changed in Supabase or R2. This is the readiness audit + the plan +
templates/tooling requested before any real import happens. Pause for
review before acting on any of it.

---

## Part 1 — Catalogue-readiness audit (read-only findings)

### 1.1 What exists today

| Area | Finding |
|---|---|
| Schema | `products`, `product_variants` (one row per size), `product_images`, `categories`, `collections`, `product_collections`. No `fabric_lot`, `tax`/`hsn`, or `fit` columns exist anywhere. |
| Live Supabase Production data | **12 products, 72 variants (6 sizes × 12), 0 image rows**, all `is_published = true`, all in one collection (`launch-edit`), across the 4 existing categories (`kurtis`, `kurti-sets`, `short-kurtis`, `co-ord-sets`). Confirmed by a live read-only query — exactly matches `scripts/seed-catalogue.mjs`, so there's no drift between the seed script and what's actually in the database. |
| Mock fallback | `src/lib/products/seed.ts` mirrors the same 12 demo products — used only when Supabase env vars are absent (local offline dev, CI). Not the source of truth; irrelevant to the real import. |
| Import tooling | `scripts/import-catalogue.mjs` — CSV → Supabase, **one row per variant**, upserts products by `slug` and variants by `sku`. Required columns: `slug,name,category_slug,base_price,size,sku,price,stock_qty`. Optional/recognized: `collections,description,fabric,care_instructions,sale_price,is_published`. **Any other CSV column is silently ignored** — confirmed by reading the script; it only reads columns it explicitly looks up by header name. This means the extended template below (with lot/fit/image/tax reference columns) is safe to feed to the existing importer with zero code changes. |
| Image import | **No bulk image tool exists.** `import-catalogue.mjs` never touches `product_images`. Today, images are added one row at a time in Supabase Studio (per `docs/09-catalogue-management.md` §C). Not workable at ~100-product scale — see §6 below for the plan (design now, build later, explicitly flagged as deferred). |
| R2 configuration | **Not actually connected yet.** Checked `.env.local` directly: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` are all **empty**. Only `R2_BUCKET_NAME=velmaya-media` is set (a name, not a working connection). `src/lib/r2.ts` (the upload helper) is not imported anywhere in `src/` today — it's unused scaffolding. **This is a blocker for real photography upload, not just an inconvenience — it has to be provisioned before any image work starts.** |
| Image rendering | Every product image is a fixed **4:5 portrait**, already specified in `docs/02-information-architecture.md` §Image Standards: min. 2000px long edge before compression, WEBP delivery, target <300KB after optimization, `shot_type` enum (`front/back/side/fabric_closeup/detail_closeup/lifestyle`), `display_order` where `0` = the primary/cover image shown on cards and the default gallery image. Products with zero image rows render a branded placeholder — the storefront degrades gracefully, so nothing breaks if images lag behind product data. |
| Fit/sizing content | The PDP's "Fit & sizing" accordion (`src/components/product/product-info.tsx`) is **static boilerplate today, not per-product data** — there's no `fit` column or field anywhere in the pipeline. Documented and worked around below (§2), not silently ignored. |
| Tax/HSN | No tax computation exists anywhere in checkout — prices are treated as tax-inclusive MRP ("Taxes included. Calculated at checkout." is fixed cart copy, not a real calculation). No HSN/GST columns in the schema. Handled below as **reference-only** CSV columns for the founder's own bookkeeping, not wired into the app. |
| Draft/publish mechanism | `products.is_published` already exists and is already enforced correctly: `getAllProducts()` (`src/lib/products/queries.ts`) filters `.eq("is_published", true)` — a draft product is **fully invisible** to the storefront (not shown, not statically generated, no leaked URL). This is the core mechanism the draft→review→published workflow below is built on — no new code needed. |
| Publish vs. deploy | `product/[slug]` and `shop/[category]` are **statically generated at build time** (confirmed in every `npm run build` output as `●` SSG routes). Flipping `is_published` in Supabase does **not** instantly change the live production site — it only takes effect on the next `npm run cf:deploy`. This is a real, already-existing safety buffer, used deliberately in the review workflow below (§8). |
| RLS on catalogue tables | `products`, `product_variants`, `product_images`, `categories`, `collections` have **no RLS enabled at all** (confirmed in `supabase/migrations/20260625120000_m5_orders.sql` — only order/payment/customer tables got RLS). This is a pre-existing condition unrelated to the current task, out of scope to fix here, but worth flagging: the anon key's access to these tables depends entirely on Supabase's default grants, not an explicit policy. Noting it for awareness; not addressed by this plan. |
| CI | Unaffected either way — `.github/workflows/ci.yml` never touches real Supabase (it builds against the mock fallback). Real catalogue changes carry zero CI risk. |

### 1.2 What this means for the plan

- The existing CSV importer can be reused as-is for products/variants/pricing/stock — no code changes needed for that part.
- Image bulk-import has no tooling yet and R2 isn't connected yet — both must be set up before real photography can go live. Plan below designs the convention now; building the actual upload script is a explicitly-flagged next step, not done in this pass.
- The draft (`is_published=false`) → review → publish → deploy pipeline already works today with zero new code, and gives a genuine two-step safety buffer (DB publish vs. site deploy) — this is the backbone of the safety plan.

---

## Part 2 — Field mapping (schema vs. what's requested)

| Requested field | Where it lives |
|---|---|
| Product name, slug, description, category | `products` table — direct columns, no change |
| Fabric, care instructions | `products.fabric`, `products.care_instructions` — direct columns |
| Collections | `product_collections` link table, via CSV `collections` column (semicolon-separated slugs) |
| Fabric lot | **No DB column.** Internal-only CSV column (`fabric_lot`), ignored by the importer, used purely for photography-batching and QC traceability in your own working spreadsheet. Not stored in Supabase. If lot tracking ever needs to be queryable, that's a small future migration — out of scope here. |
| Size, SKU, price, sale price, stock | `product_variants` — one row per size, direct columns |
| Fit notes | **No DB column, no rendering destination today** (the PDP's "Fit & sizing" section is static copy — see §1.1). Two-part handling: (1) captured in the CSV now (`fit_notes` column) so it's not lost, and folded into the end of `description` at prep time using a fixed one-line format so it's at least customer-visible immediately with zero code changes; (2) recommended as a small **future** enhancement — add a real `fit_notes` column + render it in `ProductInfo`, replacing the static text. Not built in this pass. |
| Images (multiple per product) | `product_images` table — see §6 for the full convention; **no bulk-import tool exists yet**, so this is designed now and flagged as a follow-up build, not usable today without that follow-up. |
| Tax / HSN / GST rate | **No DB column, no checkout logic.** Reference-only CSV columns (`hsn_code`, `gst_rate`) for your own records/GST filing outside this system. Not imported, not computed, not displayed. |

---

## 3. SKU naming convention

Extends the existing pattern (`VLM-{CATEGORY}-{STYLE}-{SIZE}`, e.g. the demo catalogue's `VLM-K-ROSE-M`) with a **sequential style number instead of a mnemonic**, so uniqueness is guaranteed by construction at ~100-product scale instead of relying on distinct-enough color names.

```
VLM-{CAT}-{SEQ}-{SIZE}
```

- `CAT` — category code: `K` (kurtis), `KS` (kurti-sets), `SK` (short-kurtis), `CO` (co-ord-sets) — matches the 4 existing categories exactly.
- `SEQ` — 3-digit sequential number **within that category**, assigned in the order you onboard products (`001`, `002`, …). Never reused, even if a product is later archived.
- `SIZE` — `XS | S | M | L | XL | 2XL`.

Example: the 7th kurti style onboarded → `VLM-K-007-M` for the Medium variant.

**Why sequential instead of a name-based mnemonic:** at 12 products, "ROSE"/"INDI"/"SAFF" are easy to keep distinct by eye. At ~100, similarly-worded color/style names (two different rust-orange kurtis, say) risk an accidental collision that the mnemonic approach can't catch by construction — a sequence number can't collide unless you reuse a number on purpose. `verify-catalogue.mjs` (§13) also computes and suggests the next free number per category so you never have to track the count by hand.

**Never reuse or renumber an existing SKU** — see §9.

## 4. Slug naming convention

Unchanged from the existing pattern (already used by all 12 demo products and enforced as the product's permanent URL):

```
{descriptor}-{fabric-or-detail}-{category-word}
```

kebab-case, all lowercase, 3–5 words, descriptive enough to be readable in a URL and in search results. Examples already in use: `rosewood-cotton-kurti`, `terracotta-coord-set`, `ivory-embroidered-kurti-set`.

- Must be globally unique across the **entire** catalogue (not just per category) — enforced by the DB's `unique` constraint on `products.slug`, and checked pre-import by `verify-catalogue.mjs`.
- **Never reuse a slug from an existing product** (demo or real) unless you specifically intend to *update* that exact product — the importer treats a matching slug as an update-in-place. See §9.
- Once published, do not change a slug — per the existing guardrail in `docs/09-catalogue-management.md`, it breaks the product's URL and any SEO/sharing links already out in the world.

## 5. Image naming and R2 folder convention

Two mirrored layers — local staging (before upload) and R2 (after upload) use the **same relative path**, so the eventual upload step is a straight folder mirror with no renaming logic.

**Local staging**, one folder per product slug:
```
catalogue-staging/{product-slug}/{seq}-{shot_type}.webp
```

**R2**, once uploaded (same relative structure, under a `products/` prefix):
```
products/{product-slug}/{seq}-{shot_type}.webp
```

- `seq` — 2-digit sequence (`01`, `02`, …) — this becomes `product_images.display_order`. `01` is always the primary/cover image.
- `shot_type` — must be exactly one of the DB's allowed values: `front`, `back`, `side`, `fabric_closeup`, `detail_closeup`, `lifestyle` (matches `docs/02`'s shot list exactly).
- File format WEBP, 4:5 portrait, ≥2000px long edge before compression, target <300KB after — same spec already documented in `docs/02-information-architecture.md`, nothing new invented here.

Example: `catalogue-staging/rosewood-cotton-kurti/01-front.webp`, `02-back.webp`, `03-fabric_closeup.webp`.

**Why this convention:** the filename is self-describing (sequence + shot type, both required by the schema), so `verify-catalogue.mjs` can validate images without a separate metadata column, and a future upload script only needs to walk the staging folder and mirror it — no manual sequence/shot-type bookkeeping.

## 6. How multiple images are assigned to each product

Each product's CSV row-group carries one extra reference column, **`image_filenames`** — a semicolon-separated, ordered list of the filenames staged under that product's `catalogue-staging/{slug}/` folder (same convention as the existing `collections` column):

```
image_filenames = 01-front.webp;02-back.webp;03-side.webp;04-fabric_closeup.webp;05-detail_closeup.webp
```

- Order in the list = `display_order`. First filename = primary image (cards, default gallery view).
- `alt_text` is auto-generated, not a separate column, using the same format the current seed data already uses: `"{Product Name}, {shot type with underscores replaced by spaces}"` — e.g. `"Rosewood Cotton Kurti, fabric detail"`.
- Recommended minimum: **3 images** (front, back, plus one of fabric/detail/lifestyle). `verify-catalogue.mjs` warns below that threshold and blocks at zero for anything marked ready to publish.

**Important — this column is not consumed by anything today.** `import-catalogue.mjs` ignores unknown columns (confirmed by reading it), so `image_filenames` passes through harmlessly. Turning it into actual `product_images` rows needs a small new script (`import-images.mjs` — not built in this pass) that: (1) confirms R2 is configured, (2) uploads each staged file to R2 at the matching key, (3) inserts the corresponding `product_images` row. `verify-catalogue.mjs` (§13, built now) validates the local files and convention *today*, so the moment that upload script exists, the data is already clean and ready — flagged clearly as the next build step, not assumed to already work.

## 7. How XS–2XL variants are created

Same mechanism the existing importer already provides — no new code:

- **One CSV row per size** the style is stocked in, all sharing the same `slug` (grouped by the importer).
- Sizes come from the fixed set `XS, S, M, L, XL, 2XL` — enforced by the DB's `check` constraint on `product_variants.size`; any other value fails the import outright.
- A style doesn't have to offer all six sizes — omit a row for a size you're not stocking. `verify-catalogue.mjs` reports (as a **warning**, not a block) which sizes are missing per product, so it's always a visible, deliberate choice rather than a silent gap.
- Each size row gets its own `sku`, `price` (can differ per size if needed, though typically identical across a style), `sale_price` (blank = no sale), and `stock_qty`.

## 8. Draft → review → published workflow

This uses the app's existing `is_published` mechanism and the existing build-time/deploy-time split — nothing new to build.

1. **Draft.** Import the CSV with `is_published=false` on every new row (the template and example default to this). Products exist in Supabase, fully invisible to the storefront — `getAllProducts()` filters `is_published=true`, so a draft product isn't rendered, isn't statically generated, and has no reachable URL.
2. **Review.**
   - Run `verify-catalogue.mjs` against the CSV *before* importing (§13) — catches structural/data problems for free, offline.
   - After import, spot-check the actual rows in Supabase Studio's Table Editor (fields, prices, stock).
   - Open each `product_images` R2 URL directly in a browser to confirm the photo is right-side-up, correctly cropped, and actually the right product.
   - **Live-data preview without going public:** flip a small batch to `is_published=true` in Studio, then run `npm run dev` locally. Local dev renders every page per-request against live Supabase (it isn't statically pre-built the way the deployed production site is), so newly-published products show up immediately and accurately — a real, working preview, not a simulation. If anything looks wrong, flip it back to `is_published=false` in Studio — nothing was ever deployed, so there's nothing to undo on the live site.
3. **Published (in the database).** Once a product passes review, `is_published=true` is the final state. This alone does **not** make it visible to real customers yet — see the next step.
4. **Live (on the actual site).** The production site is a static build (`npm run cf:deploy` — see `docs/13-production-deployment-cloudflare.md`). Published products only become publicly visible after that rebuild+redeploy runs. This gap is deliberate and useful: it's your last checkpoint — verify the full published set in Studio/local-dev first, deploy once, rather than each `is_published` toggle going live individually and unpredictably.

## 9. How to avoid overwriting existing products accidentally

The importer's upsert behavior is the real risk here, and it's not hypothetical:

- **Slug collision:** `import-catalogue.mjs` upserts products `onConflict: "slug"`. If a new CSV row accidentally reuses an existing slug — a real product's own slug (re-editing, expected) or, worse, a typo that happens to match one of the **12 demo slugs** — the existing row's `name`, `description`, `category`, `fabric`, `base_price`, and `is_published` are silently overwritten in place. No error, no warning from the importer itself.
- **SKU collision — the more dangerous one:** variants upsert `onConflict: "sku"`. If a new CSV row's `sku` happens to match an *existing* variant's SKU that belongs to a **different product**, that variant silently gets **re-parented** — its `product_id`, `size`, `price`, and `stock_qty` all get overwritten to match the new row, effectively stealing that SKU (and its order history linkage) away from the product it used to belong to.

**Mitigation — enforced by `verify-catalogue.mjs` before any import runs, not left to manual diligence:**
1. It cross-checks every slug and SKU in the CSV against what's actually live in Supabase right now (read-only `SELECT`).
2. Any CSV slug matching one of the 12 known demo slugs → **hard error**, blocks the run.
3. Any CSV SKU matching an existing SKU that belongs to a *different* slug than the CSV row intends → **hard error**, blocks the run.
4. Any CSV slug that already exists in the DB under the *same intended* product (i.e., a genuine, deliberate update) → reported clearly as `UPDATE`, not silently allowed through — so it's always a visible decision, never a surprise.
5. Duplicate slugs/SKUs *within the CSV itself* (the classic copy-paste-and-forget-to-change mistake) → hard error.

No slug/SKU prefix scheme is needed to "separate" real products from demo ones — real product names/styles will naturally differ from the 12 demo entries, and the collision check above is the actual safety net, not naming convention alone.

## 10. Archiving demo products (only after real products are verified)

**Never hard-delete** the demo products — this repeats the existing guardrail in `docs/09-catalogue-management.md` ("never hard-delete a product/variant that has orders") and costs nothing to follow even though no orders currently reference them.

Sequence — only after the real catalogue is imported, reviewed, published, **and confirmed live** on the actual deployed site (i.e., after step 4 in §8 has fully happened and you've checked the live site yourself):

1. In Supabase Studio, set `is_published=false` on exactly the 12 known demo slugs (listed in §1.1 — the same list `verify-catalogue.mjs` uses for collision-checking).
2. Redeploy (`npm run cf:deploy`) so the static site rebuilds without them.
3. Confirm on the live site that the demo products are gone and the real catalogue is intact.
4. Leave the archived rows in place indefinitely — `is_published=false` is a complete, free, instantly-reversible archive. There is no reason to ever delete them.

If anything about the real catalogue turns out wrong *after* this step, reverse it by flipping the demo products' `is_published` back to `true` and redeploying — the storefront is never left with zero products at any point in this sequence.

## 11. Rollback and backup plan

**Before touching anything (mandatory, not optional):**
- Supabase Studio → Table Editor → export each catalogue table (`products`, `product_variants`, `product_images`, `categories`, `collections`, `product_collections`) as CSV, into a dated local folder (e.g. `catalogue-backups/2026-07-10/`). This is a built-in Studio feature — no code, no CLI, usable by a non-technical operator. This is the primary safety net and should happen every time, right before any import.
- If you (or a developer) have the Supabase CLI linked, `supabase db dump` gives a full schema+data snapshot as a second, more complete layer — recommended in addition to, not instead of, the Studio export.
- Separately, check your Supabase plan's automatic backup/point-in-time-recovery retention window (Studio → Database → Backups) so you know what it covers *before* you need it — don't rely on it as the only safety net regardless of what it shows, since retention windows vary by plan.

**Rollback scenarios:**
| Situation | Fix |
|---|---|
| Bad CSV import on new draft products (never published, never bought) | Delete those specific rows directly in Studio — safe, nothing references them yet — or re-run a corrected CSV (upsert overwrites cleanly by slug/SKU). |
| A slug/SKU collision overwrote an existing product's data | Restore that product's exact prior values from the pre-import CSV export, re-imported as a corrective CSV. This is exactly why the backup step above is mandatory — `verify-catalogue.mjs` should catch this *before* it happens, but the backup is what fixes it if it somehow doesn't. |
| A published product is visibly wrong on the **live** site right now | Fastest fix: `npx wrangler rollback` to the previous Worker deployment (already documented in `docs/13-production-deployment-cloudflare.md` §12) — instantly reverts the entire live site to the last known-good build while you fix the underlying data, then redeploy properly. |
| Large-scale/unexpected corruption | Restore from the Studio CSV export (or `supabase db dump`, or Supabase's own backup feature if the retention window covers it) — in that order of speed/reliability. |

## 12. Step-by-step operating guide for the founder (non-technical)

This is the actual sequence to run through, once photography and pricing are ready. Steps marked **(developer)** need someone comfortable with the terminal; everything else is Supabase Studio (a website) or a spreadsheet.

1. **(Backup first, always)** Open Supabase Studio → Table Editor → export `products`, `product_variants`, `product_images`, `categories`, `collections` as CSV to a dated folder on your computer. Takes 5 minutes, do it every time before an import.
2. **Fill in the spreadsheet.** Open [`docs/catalogue-real-launch-template.csv`](catalogue-real-launch-template.csv) in Excel or Google Sheets. One row per size per product — see the fully filled example at [`docs/catalogue-real-launch-example.csv`](catalogue-real-launch-example.csv) for exactly what a complete product looks like. Use the per-product checklist ([`docs/catalogue-product-prep-checklist.md`](catalogue-product-prep-checklist.md)) for every single product before you consider it ready.
3. **Stage the photos.** For each product, create a folder `catalogue-staging/{that product's slug}/` and put its photos in it, named `01-front.webp`, `02-back.webp`, etc., per §5 above. List those exact filenames in that product's `image_filenames` column in the spreadsheet.
4. **Set every new row's `is_published` to `false`.** This is your safety switch — nothing goes live until you deliberately flip it later.
5. **Save as CSV.**
6. **(Developer) Run the automated check:** `npm run verify:catalogue -- path/to/your.csv catalogue-staging`. Fix everything it reports as an error (red) before continuing. Warnings (yellow) are worth reading but won't block you.
7. **(Developer) Run the import:** `npm run import:catalogue -- path/to/your.csv`. This only touches `products`/`product_variants`/collections — images still need the separate upload step referenced in §6, which is a planned follow-up, not available yet.
8. **Review in Studio.** Check the new rows: right category, right prices, right stock, description reads well.
9. **Preview for real, without going public.** Pick a handful of products, flip their `is_published` to `true` in Studio, then have your developer run `npm run dev` and open the site on `localhost` — this shows you exactly how they'll look, using the real data, without anything being visible to real customers yet.
10. **Once you're happy, flip `is_published=true`** on everything that's ready (Studio, or by re-importing the CSV with that column set to `true`).
11. **(Developer) Deploy:** `npm run cf:deploy`. This is the step that actually makes the new products visible to real customers.
12. **Check the live site yourself.** Browse the real store, confirm everything you expect to see is there and looks right.
13. **Only now, archive the 12 demo products** — §10 above — then redeploy once more.
14. Keep your dated backup folder from step 1 until you're fully confident everything is correct — don't delete it same-day.

---

## What's included alongside this plan

- [`docs/catalogue-real-launch-template.csv`](catalogue-real-launch-template.csv) — blank template, header row only, ready to fill in.
- [`docs/catalogue-real-launch-example.csv`](catalogue-real-launch-example.csv) — one fully completed product with all six size variants (XS–2XL), showing every column filled correctly.
- [`docs/catalogue-product-prep-checklist.md`](catalogue-product-prep-checklist.md) — a print/copy-friendly per-product checklist.
- [`scripts/verify-catalogue.mjs`](../scripts/verify-catalogue.mjs) (`npm run verify:catalogue`) — reports missing images, duplicate SKUs/slugs (within the CSV and against live Supabase), invalid prices, missing sizes, and stock issues, before anything is imported.

## Explicitly not done in this pass

- No data was imported, updated, or deleted in Supabase or R2.
- No image bulk-upload script was built (`import-images.mjs`) — designed in §6, flagged as the next build step once this plan is approved.
- R2 credentials were not provisioned — `.env.local`'s R2 values are still empty; this needs to happen before any real photo upload work, technical or not.
- No per-product `fit_notes` database column or UI change was made — fit notes fold into `description` text for now per §2, with a real field flagged as a future enhancement.
- The catalogue-tables RLS gap noted in §1.1 was not addressed — out of scope for this task.

**Awaiting review before any further action.**
