# Per-product prep checklist

Copy this list for **each** product before you consider it ready for the
spreadsheet. See `docs/15-real-catalogue-onboarding-plan.md` for the full
plan this supports, and `docs/catalogue-real-launch-example.csv` for a
completed reference row.

## Product identity
- [ ] **Slug** chosen — kebab-case, 3–5 words, e.g. `amber-handloom-cotton-kurti` — checked it doesn't already exist (demo or real)
- [ ] **Name** written — the customer-facing display name
- [ ] **Category** confirmed — one of `kurtis`, `kurti-sets`, `short-kurtis`, `co-ord-sets` (spelled exactly like that)
- [ ] **Collection(s)** decided, if any (e.g. `launch-edit`) — leave blank if none

## Copy
- [ ] **Description** written (1–3 sentences, matches the brand voice of existing products)
- [ ] **Fabric** described (e.g. "100% handloom cotton")
- [ ] **Care instructions** written
- [ ] **Fit notes** written (one line — relaxed / true-to-size / runs small, etc.) — this gets folded into the end of the description per the documented convention

## Pricing
- [ ] **Base price** set (same as the price used across sizes, unless sizes are deliberately priced differently)
- [ ] **Sale price** decided — leave blank if not on sale; if set, it must be *lower* than the regular price
- [ ] **HSN code** and **GST rate** noted for your own records (reference only — not used by checkout; confirm the correct code/rate with your accountant, this is not tax advice)

## Fabric lot
- [ ] **Fabric lot code** assigned (e.g. `LOT-01`) — for your own batch/QC tracking, same lot across products cut from the same fabric batch

## Sizes & stock (repeat per size you're stocking)
- [ ] Every size you're stocking has: a **SKU** (next sequential number in that category, e.g. `VLM-K-014-M`), a **price**, and a **stock quantity**
- [ ] Sizes you are *not* stocking are simply left out — not a zero-stock row
- [ ] Double-checked the SKU isn't already used anywhere (the verification script checks this too, but check as you go)

## Photography
- [ ] Photos staged in `catalogue-staging/{this product's slug}/`
- [ ] Filed named `01-front.webp`, `02-back.webp`, etc. — sequence + one of `front / back / side / fabric_closeup / detail_closeup / lifestyle`
- [ ] At least 3 images (front + back + one of fabric/detail/lifestyle recommended minimum)
- [ ] Each photo: 4:5 portrait, ≥2000px on the long edge before compression, WEBP format, consistent background with the rest of the shoot
- [ ] `image_filenames` column filled in with the exact filenames, in display order, semicolon-separated

## Before adding to the spreadsheet
- [ ] `is_published` set to `false` — stays a draft until reviewed
- [ ] Row added to the working CSV, one row per size, all product-level columns identical across that product's rows

## After the batch is in the spreadsheet
- [ ] Ran `npm run verify:catalogue -- <csv> catalogue-staging` and fixed every error it reported
