import Link from "next/link";
import { categories } from "@/lib/site-config";
import { ProductImage } from "@/components/product/product-image";

export function FeaturedCategories() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">
            Shop by category
          </h2>
          <p className="mt-2 text-muted-foreground">
            Four ways to wear Velmaya, every day.
          </p>
        </div>
        <Link
          href="/shop"
          className="hidden text-sm font-medium text-accent hover:underline sm:block"
        >
          View all →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link key={cat.slug} href={`/shop/${cat.slug}`} className="group">
            <ProductImage label={cat.name} alt={cat.name} />
            <div className="mt-3">
              <h3 className="font-display text-lg text-foreground">
                {cat.name}
              </h3>
              <p className="text-sm text-muted-foreground">{cat.blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
