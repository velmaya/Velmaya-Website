import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/product/product-gallery";
import { VariantSelector } from "@/components/product/variant-selector";
import { PdpTrust } from "@/components/product/pdp-trust";
import { ProductInfo } from "@/components/product/product-info";
import { ProductCard } from "@/components/product/product-card";
import { JsonLd } from "@/components/seo/json-ld";
import { productSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { categories } from "@/lib/site-config";
import { priceRange, formatINR } from "@/lib/products";
import {
  getProductBySlug,
  getAllProductSlugs,
  getRelatedProducts,
} from "@/lib/products/queries";

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const { min } = priceRange(product);
  return {
    title: product.name,
    description: `${product.description.slice(0, 150)} From ${formatINR(min)}.`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = categories.find((c) => c.slug === product.categorySlug);
  const related = await getRelatedProducts(product);

  const breadcrumbItems = [
    { name: "Shop", url: "/shop" },
    ...(category
      ? [{ name: category.name, url: `/shop/${category.slug}` }]
      : []),
    { name: product.name, url: `/product/${product.slug}` },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <JsonLd data={productSchema(product)} />
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />

      {/* breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        {category && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Link
              href={`/shop/${category.slug}`}
              className="hover:text-foreground"
            >
              {category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      {/* main */}
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />

        <div className="lg:py-4">
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-6">
            <VariantSelector product={product} />
          </div>

          <PdpTrust />

          <ProductInfo product={product} />
        </div>
      </div>

      {/* related */}
      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-2xl text-foreground">
            You may also like
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
