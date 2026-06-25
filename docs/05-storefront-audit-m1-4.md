# Velmaya Storefront Audit — Milestones 1–4

**Scope:** UX, UI, CRO, SEO, accessibility, responsiveness, performance, and brand
consistency review of everything built before Milestone 5 (cart/checkout).
**Status:** Report only — no changes implemented. Findings are numbered for approval.
**Date:** 2026-06-25 · **Commit reviewed:** 44f31e0

---

## Executive summary

The foundation is genuinely strong: a coherent premium design system (warm cream/
taupe palette, Fraunces + Inter, generous spacing), clean information architecture,
a real product data layer, and a stock-aware PDP. Brand handling is now correct and
centralised.

**The single biggest gap is not code — it's imagery.** Every product, the hero, and
the Instagram strip currently render branded *placeholders*. The design is premium;
the placeholders make it *feel* unfinished. Real photography is the highest-leverage
investment before launch and matters more than any refinement below.

**Verdict on "does it feel like a premium brand?"** The *system* does. The *content*
(photography, reviews, finalised policy details) does not yet. Close those and this
reads as a credible D2C label.

**Recommended pre-M5 work:** the HIGH items below are mostly small, high-impact, and
independent of payments. They're worth doing as one "refinement" commit before M5.

---

## Priority legend
- **HIGH** — do before launch / before M5; hurts conversion, trust, or accessibility now.
- **MEDIUM** — do during polish; noticeable but not blocking.
- **LOW** — nice-to-have; backlog.

Effort: **S** (<1h) · **M** (half-day) · **L** (day+).

---

## HIGH priority

### H1 — Real product & lifestyle photography *(Brand/CRO/Trust · L · content)*
Hero, all product cards, PDP gallery, and the Instagram grid use placeholders
(`ProductImage` with no `url`). This is the #1 thing gating "premium." The data layer
and `ProductImage` already swap `url` in with zero layout shift, so the work is
purely producing images. Even 4–6 strong hero/lifestyle shots + clean product flatlays
would transform perception. (Ties directly to the founder's stated cost-efficient
shooting challenge — worth solving deliberately.)

### H2 — PDP is missing trust & logistics near the CTA *(CRO/Trust · M)*
`product/[slug]/page.tsx` shows price, size, fabric, care, and the WhatsApp CTA, but
the highest-converting page has **no delivery estimate, no returns reassurance, and no
trust signals** beside the buy action. Add a compact block near the CTA: "Ships in
2–4 days · Easy size exchange · Secure checkout," each linking to the relevant policy.
This is standard on premium PDPs and cheap to add.

### H3 — Gold accent fails colour-contrast for text/CTAs *(Accessibility/Readability · S–M)*
`--accent #b08d57` on `--background #faf6f0` is ≈2.6:1 — below WCAG AA (4.5:1) for
normal text. It's used for links ("View all", "Size guide", low-stock note) **and** as
the WhatsApp CTA background with cream text (also ≈2.6:1). Either darken the accent for
text/CTAs (e.g. a deeper bronze ~#8a6d3f → ~4.6:1) or pair gold backgrounds with the
dark mocha foreground instead of cream. Affects every gold element site-wide.

### H4 — Cloudflare image optimisation not configured *(Performance · M)*
`next.config.ts` notes Next's optimiser isn't available on Workers, but `images` has no
`unoptimized`/loader strategy. In production on Cloudflare, `next/image` (now used for
logos and all product imagery) may not serve optimised sizes — directly threatening the
Lighthouse 95+ / Core Web Vitals target. Decide the strategy (CF Images loader, or
`unoptimized: true` + pre-sized assets) before launch.

### H5 — Forms are non-functional *(UX/Trust · M)*
The newsletter form (footer) and contact form (`contact/page.tsx`) have no submit
handler — they silently do nothing. A visitor who submits and sees no response loses
trust. Either wire them (even to a simple endpoint / mailto / WhatsApp) or clearly mark
them "coming soon." The contact form already notes wiring comes later; the newsletter
does not.

### H6 — Mega menu is mouse-only (keyboard/focus inaccessible) *(Accessibility · M)*
`mega-menu.tsx` opens on `onMouseEnter` only. Keyboard and touch users can't open the
Shop panel (the link still navigates, but the category shortcuts are unreachable). Add
focus/click handling and `aria-expanded`. Also add a focus trap + `Esc`-to-close to the
mobile drawer (`mobile-nav.tsx`).

---

## MEDIUM priority

### M1 — `muted-foreground` body text is borderline contrast *(Accessibility · S)*
`--muted-foreground #7a6f63` on cream is ≈4.26:1 — just under AA for small text. Used
widely (prices, descriptions, captions). Nudge ~10% darker (e.g. ~#6f6457) to clear 4.5:1.

### M2 — No structured data (schema.org) *(SEO · M)*
Zero JSON-LD. For an e-comm storefront the high-value ones are `Product` (with price/
availability) on the PDP, `BreadcrumbList`, `FAQPage` (the `/faq` data is already
structured in `lib/faq.ts`), and `Organization`. Largely Milestone 9 scope, but `Product`
+ `Breadcrumb` are worth front-loading since they affect search appearance immediately.

### M3 — No `sitemap.xml` / `robots.txt` *(SEO · S)*
Next supports `app/sitemap.ts` and `app/robots.ts` natively; both are trivial to add and
expected by crawlers. (Milestone 9, but flagging for the launch checklist.)

### M4 — `prefers-reduced-motion` not respected *(Accessibility · S)*
Framer Motion animations (hero, mega menu, mobile nav) always run. Respect the OS
reduced-motion setting to avoid vestibular discomfort.

### M5 — Form inputs use placeholders instead of labels *(Accessibility/UX · S)*
Contact and newsletter fields rely on placeholder text with no `<label>`. Placeholders
vanish on input and aren't reliably announced by screen readers. Add visually-hidden
labels.

### M6 — Product cards have thin interaction/affordance *(CRO/UX · M)*
Cards show image + name + price with only an image-zoom on hover. Consider a clearer
hover state, optional secondary image, and a size/quick-look affordance. Cards also don't
surface "low stock" or rating (none yet) — fine until reviews exist.

### M7 — PDP gallery lacks zoom *(UX · M)*
Thumbnails switch the main image, but there's no zoom/lightbox — important for fabric
detail in fashion. Add once real photography lands (pairs with H1).

### M8 — No reviews/social proof on cards or PDP *(CRO/Trust · M)*
Star ratings appear only in the homepage testimonials. PDPs and cards have no ratings.
Reviews are a post-launch feature, but plan the placement now; even "Be the first to
review" plus the WhatsApp/Instagram proof helps early.

### M9 — Empty/loading feedback *(UX · S)*
No `app/loading.tsx`, `not-found.tsx`, or `error.tsx`. Static pages are fast so loading
matters less, but a branded `not-found` and `error` page (using `<BrandLogo>`) prevents
the default Next fallbacks from breaking the premium feel.

---

## LOW priority

- **L1 — Announcement bar** is static and non-dismissible *(UX · S)*. Consider dismiss + rotating messages.
- **L2 — Skip-to-content link** absent *(Accessibility · S)*.
- **L3 — Unused large source PNGs** (`logo-icon.png` 538KB, `logo-reversed.png` 1MB) sit in `public/` though the app uses the trimmed `-fit`/`mark` versions. Harmless (served only if requested) but worth moving to a non-served `assets/` source folder *(Perf/hygiene · S)*.
- **L4 — Breadcrumb not on category/listing pages** (only PDP) *(SEO/UX · S)*.
- **L5 — Hero CTAs** could A/B different copy; "Shop the Edit" is good but unproven *(CRO · S)*.
- **L6 — Footer newsletter** lacks success/confirmation affordance (ties to H5) *(UX · S)*.

---

## Category scorecard (current state)

| Category | Grade | Notes |
|---|---|---|
| Visual design / brand system | A− | Palette, type, spacing, logo handling all strong |
| Information architecture | A | Clean routes, nav, footer, internal linking |
| Storytelling / trust copy | B+ | Warm, credible voice; needs faces/photography to land emotionally |
| Product/PDP UX | B | Solid structure; missing trust/logistics block, zoom, reviews |
| CRO | B− | Good funnel bones; gated by imagery, PDP trust, real checkout (M5) |
| Accessibility | C+ | Good alt/aria baseline; contrast + keyboard nav + labels need work |
| SEO | B− | Strong metadata/OG; missing schema, sitemap, robots |
| Performance | B | Great bundles/SSG; CF image strategy is the open risk |
| Responsiveness | A− | Verified across breakpoints; a few unverified (tablet PDP gallery) |

---

## Recommended sequence (before Milestone 5)

1. **Quick-win refinement commit** (½–1 day): H3, M1 (contrast), H2 (PDP trust block),
   H5/M5 (forms + labels), H6/M4 (keyboard nav + reduced motion), M9 (not-found/error).
   All small, payment-independent, and meaningfully raise polish + accessibility.
2. **Decide H4** (CF image strategy) — needs a direction even if implemented later.
3. **Photography (H1)** — parallel track; the biggest perceived-quality lever.
4. **SEO pass** (M2/M3) — can fold into Milestone 9, but `Product`/`Breadcrumb` schema
   + sitemap/robots are cheap to front-load.
5. **Then Milestone 5** — cart, orders, Razorpay (test mode), webhooks → Supabase,
   confirmation, email, WhatsApp.

---

## Pre-payment launch checklist (carry into M5+)

- [ ] Every key page verified on real mobile devices (not just emulation)
- [ ] Product images, names, sizes, fabric, and **prices** confirmed correct
- [ ] Shipping fees/timelines, return window, and GSTIN finalised (placeholders remain in policies)
- [ ] Test orders complete in **Razorpay test mode** end-to-end
- [ ] Order confirmation email + WhatsApp links verified
- [ ] GA4 + Microsoft Clarity receiving data
- [ ] Lighthouse ≥95 mobile; Core Web Vitals pass
- [ ] Policy pages reviewed by the founder for accuracy
- [ ] Supabase RLS enabled, backups on, secrets in env (not committed)
