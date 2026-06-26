# Catalogue Management Workflow

How to add and maintain products **without writing SQL**. Two paths: Supabase
Studio (point-and-click, best for small edits) and CSV import (bulk, best for
adding many products at once). The storefront reads this data live from Supabase.

> Source of truth is the **database**. `src/lib/products/seed.ts` is only an
> offline fallback for local dev without Supabase — don't treat it as the catalogue.

---

## A. Supabase Studio (day-to-day edits)

Dashboard → **Table Editor**. Relevant tables:

| Table | What you edit |
|---|---|
| `products` | one row per style: `slug` (URL, unique, lowercase-hyphenated), `name`, `description`, `category_id`, `fabric`, `care_instructions`, `base_price`, `is_published` |
| `product_variants` | one row per size: `product_id`, `size` (XS–2XL), `sku` (unique), `price`, `sale_price` (blank = no sale), `stock_qty` |
| `product_collections` | links a product to a collection (e.g. launch-edit) |
| `product_images` | `r2_url`, `alt_text`, `shot_type`, `display_order` (see Images below) |

### Add a product
1. `categories` — confirm the category exists (kurtis, kurti-sets, short-kurtis, co-ord-sets). Copy its `id`.
2. `products` — Insert row: set `slug`, `name`, `category_id`, `base_price`, and **`is_published = false`** while you set it up. Copy the new product `id`.
3. `product_variants` — Insert one row per size you stock, with `sku`, `price`, `stock_qty`.
4. (Optional) `product_collections` — link to a collection.
5. When ready, set `products.is_published = true`.

### Routine tasks
- **Restock / adjust stock:** edit `product_variants.stock_qty` directly. (The
  `inventory_movements` ledger records sales/reservations automatically — you
  don't write to it by hand.)
- **Put on sale:** set `sale_price` below `price`. Clear it to end the sale.
- **Hide a product:** set `is_published = false` (don't delete — see guardrails).

### Guardrails
- **Never hard-delete a product/variant that has orders** — `order_items`
  reference variants. Use `is_published = false` to retire a style instead.
- Don't edit `inventory_reservations` or `inventory_movements` by hand; they're
  managed by the checkout RPCs.
- `slug` and `sku` are permanent identifiers — changing a `slug` breaks its URL
  and any links/SEO.

---

## B. CSV bulk import

For adding/updating many products at once.

```
npm run import:catalogue -- path/to/catalogue.csv
```

- Template: [`docs/catalogue-template.csv`](catalogue-template.csv).
- **One row per variant** (size). Product columns repeat across a product's size
  rows; rows are grouped by `slug`.
- Columns: `slug,name,category_slug,collections,description,fabric,
  care_instructions,base_price,size,sku,price,sale_price,stock_qty,is_published`
  - `collections`: optional, semicolon-separated slugs (`launch-edit;festive`)
  - `sale_price`: blank = no sale
  - `is_published`: `true`/`false` (defaults true)
- **Idempotent:** upserts products by `slug`, variants by `sku`. Re-running
  updates existing rows. Missing categories/collections are created from their slug.
- ⚠ `stock_qty` in the CSV **overwrites** current stock. For routine restocks
  prefer Studio so you don't clobber live counts mid-day.

### Recommended bulk workflow
1. Export/edit in Excel or Google Sheets using the template columns.
2. Save as CSV.
3. `npm run import:catalogue -- products.csv`
4. Spot-check in Studio, then publish (`is_published`).

---

## C. Product images (when photography is ready)

Images live in Cloudflare **R2**; the DB stores their URLs.
1. Upload the photo to the R2 bucket (`R2_BUCKET_NAME`).
2. Add a `product_images` row: `product_id` (or `variant_id` for a size-specific
   shot), `r2_url` = the public R2 URL, `alt_text`, `shot_type`
   (`front`/`back`/`side`/`fabric_closeup`/`detail_closeup`/`lifestyle`),
   `display_order` (0 = primary).
3. Products with **no** image rows render the branded placeholder, so the store
   stays presentable until photos land.

> R2 upload tooling (drag-and-drop / bulk) is a later enhancement; until then,
> upload via the Cloudflare dashboard and paste the URL.

---

## D. Publishing changes

The storefront pre-renders product pages at **build time** (SSG). After catalogue
edits, **redeploy** to publish them (Cloudflare Pages rebuild). A future
enhancement is **ISR** (`export const revalidate = N`) so changes appear within N
seconds without a full rebuild — recommended once the catalogue changes often.

---

## Future enhancements (backlog)
- Lightweight admin UI over these tables (auth-gated) for non-technical editing.
- R2 bulk image uploader + automatic `product_images` rows.
- ISR or on-demand revalidation so edits go live without a redeploy.
- Low-stock alerts off the `inventory_movements` ledger.
