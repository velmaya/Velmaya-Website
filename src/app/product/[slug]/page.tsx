import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/product/product-gallery";
import { VariantSelector } from "@/components/product/variant-selector";
import { ProductCard } from "@/components/product/product-card";
import { categories } from "@/lib/site-config";
import {
  getProductBySlug,
  getAllProductSlugs,
  getRelatedProducts,
  priceRange,
  formatINR,
} from "@/lib/products";

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

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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

          <div className="mt-8 space-y-6 border-t border-border pt-8">
            <div>
              <h2 className="font-display text-lg text-foreground">Details</h2>
              <p className="mt-2 text-foreground/80">{product.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Fabric</p>
                <p className="mt-1 text-muted-foreground">{product.fabric}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Care</p>
                <p className="mt-1 text-muted-foreground">
                  {product.careInstructions}
                </p>
              </div>
            </div>
          </div>
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
