import { siteConfig, instagramLink, categories } from "@/lib/site-config";
import { type Product, priceRange, totalStock } from "@/lib/products";

// schema.org builders. Pure functions returning plain objects for <JsonLd>.

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/brand/logo-stacked.png`,
    description: siteConfig.description,
    sameAs: [instagramLink()],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: siteConfig.contact.email,
      areaServed: "IN",
      availableLanguage: ["en"],
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  };
}

export function productSchema(product: Product) {
  const { min, max } = priceRange(product);
  const inStock = totalStock(product) > 0;
  const category = categories.find((c) => c.slug === product.categorySlug);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: category?.name,
    brand: { "@type": "Brand", name: siteConfig.name },
    material: product.fabric,
    url: `${siteConfig.url}/product/${product.slug}`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: min,
      highPrice: max,
      offerCount: product.variants.length,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: siteConfig.name },
    },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
