"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sizes, type Size } from "@/lib/site-config";
import { type Product, priceRange, isOnSale } from "@/lib/products";

type SortKey = "featured" | "price-asc" | "price-desc";

const sortLabels: Record<SortKey, string> = {
  featured: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

function variantInStockForSize(product: Product, size: Size) {
  return product.variants.some((v) => v.size === size && v.stockQty > 0);
}

export function ProductListing({ products }: { products: Product[] }) {
  const [activeSizes, setActiveSizes] = useState<Size[]>([]);
  const [saleOnly, setSaleOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...products];
    if (activeSizes.length > 0) {
      list = list.filter((p) =>
        activeSizes.some((s) => variantInStockForSize(p, s))
      );
    }
    if (saleOnly) list = list.filter(isOnSale);

    if (sort === "price-asc") {
      list.sort((a, b) => priceRange(a).min - priceRange(b).min);
    } else if (sort === "price-desc") {
      list.sort((a, b) => priceRange(b).min - priceRange(a).min);
    }
    return list;
  }, [products, activeSizes, saleOnly, sort]);

  const toggleSize = (s: Size) =>
    setActiveSizes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const clearAll = () => {
    setActiveSizes([]);
    setSaleOnly(false);
  };

  const hasFilters = activeSizes.length > 0 || saleOnly;

  return (
    <div>
      {/* controls bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasFilters && (
            <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-accent-foreground">
              {activeSizes.length + (saleOnly ? 1 : 0)}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
            aria-label="Sort products"
          >
            {Object.entries(sortLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* filter panel */}
      {filtersOpen && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Filter by</h3>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Size (in stock)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={cn(
                    "min-w-10 rounded-md border px-3 py-1.5 text-sm transition-colors",
                    activeSizes.includes(s)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-secondary"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={saleOnly}
                onChange={(e) => setSaleOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              On sale only
            </label>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="mt-4"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* grid */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No products match these filters.{" "}
          <button
            type="button"
            onClick={clearAll}
            className="text-accent underline"
          >
            Clear filters
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
