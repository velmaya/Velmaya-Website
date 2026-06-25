import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ProductListing } from "@/components/product/product-listing";
import { categories } from "@/lib/site-config";
import { getAllProducts } from "@/lib/products";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Shop Velmaya kurtis, kurti sets, short kurtis and co-ord sets, sizes XS to 2XL.",
};

export default async function ShopPage() {
  const products = await getAllProducts();

  return (
    <>
      <PageHeader
        eyebrow="Shop"
        title="The Collection"
        subtitle="Everyday ethnic wear, sizes XS to 2XL."
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* category pills */}
        <div className="mb-8 flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
              "border-primary bg-primary text-primary-foreground"
            )}
          >
            All
          </span>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/shop/${c.slug}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              {c.name}
            </Link>
          ))}
        </div>

        <ProductListing products={products} />
      </section>
    </>
  );
}
