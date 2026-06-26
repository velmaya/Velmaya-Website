import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProductListing } from "@/components/product/product-listing";
import { categories } from "@/lib/site-config";
import { getProductsByCategory } from "@/lib/products/queries";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = categories.find((c) => c.slug === category);
  return {
    title: cat ? cat.name : "Shop",
    description: cat?.blurb,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = categories.find((c) => c.slug === category);
  if (!cat) notFound();

  const products = await getProductsByCategory(cat.slug);

  return (
    <>
      <PageHeader eyebrow="Shop" title={cat.name} subtitle={cat.blurb} />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* category pills */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/shop"
            className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                c.slug === cat.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-secondary"
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {products.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Products in this category are coming soon. Follow us for the drop.
          </p>
        ) : (
          <ProductListing products={products} />
        )}
      </section>
    </>
  );
}
