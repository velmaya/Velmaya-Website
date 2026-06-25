# Velmaya — Information Architecture

## Sitemap

```
/                              Home
/our-story                     Brand story (mission/values, no founder-bio)
/about                         About Velmaya (short version, links to /our-story)
/shop                          All products (PLP, filterable)
/shop/[category]               Category PLP (kurtis, kurti-sets, short-kurtis, co-ord-sets)
/collections/[slug]            Collection PLP (e.g. launch collection, seasonal drop)
/product/[slug]                Product detail page (PDP)
/cart                          Cart
/checkout                      Checkout (address, Razorpay payment)
/checkout/confirmation         Order confirmation
/size-guide                    Size guide (added in Milestone 7, once chart is integrated)
/faq                           FAQ
/contact                       Contact (form + WhatsApp/Instagram links)
/policies/privacy              Privacy Policy
/policies/terms                Terms & Conditions
/policies/shipping             Shipping Policy
/policies/returns              Return / Exchange Policy
```

Backlog routes (not built in this pass): `/account/*`, `/wishlist`, `/journal` (Founder Journal), `/journal/[slug]`.

## Navigation Structure

**Header (desktop)**: Logo (center or left) — Shop (mega menu: Kurtis / Kurti Sets / Short Kurtis / Co-ord Sets / Shop All) — Our Story — FAQ — [Search icon] — [Cart icon]

**Mega menu (Shop)**: columns per category, each linking to `/shop/[category]`, plus a featured collection tile linking to the current `/collections/[slug]` launch collection.

**Mobile nav**: hamburger → full-screen slide-in menu mirroring desktop structure, cart and search as persistent bottom/top icons.

## Footer Structure

- **Shop**: links to each category + Shop All
- **Company**: Our Story, About, Contact, FAQ
- **Support**: WhatsApp link, Instagram link, Shipping Policy, Returns/Exchange
- **Legal**: Privacy Policy, Terms & Conditions
- **Bottom bar**: © Velmaya, GST/trademark line (as required), payment method icons (Razorpay-supported)

## URL Structure

- Lowercase, hyphenated slugs throughout: `/product/floral-co-ord-set-rose`, `/shop/kurti-sets`
- Category slugs fixed to the four product types at launch: `kurtis`, `kurti-sets`, `short-kurtis`, `co-ord-sets`
- Collection slugs free-form per drop: `/collections/launch-edit`, `/collections/festive-24`

## Internal Linking Strategy

- Every PDP links to: its category PLP, 4–6 related products (same category/collection), and the size guide
- Homepage links into the current launch collection and into `/our-story` above the fold
- Policy pages cross-link to each other and to `/contact` and the WhatsApp link
- Category PLPs link up to `/shop` and across to sibling categories (cross-sell co-ord ↔ kurti sets)

## User Flow / Conversion Funnel

```
Visitor (Instagram/organic/search)
   ↓
Story (homepage hero + brand teaser, or /our-story)
   ↓
Trust (policy visibility, WhatsApp/Instagram presence, testimonials)
   ↓
Product Discovery (PLP browse, filters by size/category)
   ↓
Product Page (gallery, variant/size selection, related products)
   ↓
Cart (review, quantity/size edit)
   ↓
Checkout (address + checkout_sessions capture of email/phone pre-payment)
   ↓
Payment (Razorpay)
   ↓
Confirmation (order summary, WhatsApp support entry point)
   ↓
WhatsApp Support (sizing/order questions, post-purchase)
   ↓
Repeat Purchase (direct return via WhatsApp/Instagram/site, future newsletter/journal touchpoints)
```

Key funnel design decision: **trust signals (story, policies, support channels) are surfaced early and throughout**, not isolated to a footer — directly supporting the conversion strategy in the brand architecture doc.

## Launch Collection Strategy

Rather than launching all 20 fabric lots simultaneously:

- **Collection 01 ("Launch Edit")**: select 8–12 hero SKUs across the four categories from the 20 lots, prioritizing pieces that are easiest to photograph well and represent the size range (XS–2XL) clearly.
- Remaining lots staged as a **Collection 02** drop a few weeks after launch — gives time to photograph properly, gather initial reviews/social proof from Collection 01, and avoid spreading limited photography/QC effort across all 20 lots at once.
- Each collection gets its own `/collections/[slug]` page and homepage feature slot, reinforcing a "drop" cadence that supports future repeat-visit behavior (customers checking back for the next collection).

## Image Standards

Formalized now so real photography (once scheduled) has a clear spec to shoot against; placeholder images in the initial build use the same aspect ratios/dimensions so the swap later requires no code changes.

**Shot list per product (per colorway where applicable):**
- Front (on model or flat-lay, consistent choice per category)
- Back
- Side
- Fabric closeup (texture/weave visible)
- Detail closeup (neckline, print, embroidery, button/tie detail — whatever is the product's distinguishing feature)
- Lifestyle/styled shot (optional but recommended for hero PDP image and homepage/collection features)

**Technical spec:**
- Aspect ratio: 4:5 (portrait) for PDP gallery and product cards, consistent across the catalogue
- Minimum resolution: 2000px on the long edge before compression
- Format: WEBP for web delivery
- Target file size: under 300KB per image after optimization
- Background: consistent (single neutral background or consistent lifestyle setting per shoot) so PLP grids look cohesive
- Storage: all final images uploaded to Cloudflare R2; Supabase `product_images` rows store the R2 URL + alt text + display order only
