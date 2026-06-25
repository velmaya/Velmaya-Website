// Single source of truth for brand contact info, navigation, and categories.
// Contact values read from env where they may change (WhatsApp number etc.),
// so they can be updated in one place — see .env.example.

export const siteConfig = {
  name: "Velmaya",
  tagline: "Everyday ethnic wear, made to fit",
  description:
    "Kurtis, kurti sets, short kurtis and co-ord sets designed for everyday wear, in sizes XS–2XL.",
  url: "https://velmaya.com",

  contact: {
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919597075752",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "shop.velmaya@gmail.com",
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? "labelvelmaya",
  },
} as const;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${siteConfig.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function instagramLink() {
  return `https://instagram.com/${siteConfig.contact.instagram}`;
}

export type Category = {
  slug: string;
  name: string;
  blurb: string;
};

// The four launch categories (see docs/02-information-architecture.md).
export const categories: Category[] = [
  {
    slug: "kurtis",
    name: "Kurtis",
    blurb: "Everyday silhouettes in fabrics that breathe.",
  },
  {
    slug: "kurti-sets",
    name: "Kurti Sets",
    blurb: "Coordinated tops and bottoms, ready to wear.",
  },
  {
    slug: "short-kurtis",
    name: "Short Kurtis",
    blurb: "Easy, modern lengths for day to day.",
  },
  {
    slug: "co-ord-sets",
    name: "Co-ord Sets",
    blurb: "Matched sets that do the styling for you.",
  },
];

export const mainNav = [
  { label: "Shop", href: "/shop" },
  { label: "Our Story", href: "/our-story" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const footerNav = {
  shop: [
    { label: "All Products", href: "/shop" },
    ...categories.map((c) => ({ label: c.name, href: `/shop/${c.slug}` })),
  ],
  company: [
    { label: "Our Story", href: "/our-story" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/faq" },
  ],
  support: [
    { label: "Shipping Policy", href: "/policies/shipping" },
    { label: "Returns & Exchanges", href: "/policies/returns" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/policies/privacy" },
    { label: "Terms & Conditions", href: "/policies/terms" },
  ],
};

export const sizes = ["XS", "S", "M", "L", "XL", "2XL"] as const;
export type Size = (typeof sizes)[number];
