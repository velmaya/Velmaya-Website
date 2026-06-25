"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product/product-image";
import type { ProductImage as ProductImageType } from "@/lib/products";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: ProductImageType[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const list = images.length > 0 ? images : [{ alt: name }];
  const current = list[active];

  return (
    <div className="flex flex-col gap-4">
      <ProductImage
        src={current.url}
        alt={current.alt}
        label={name}
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
      />

      {list.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {list.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "overflow-hidden rounded-md ring-2 transition",
                i === active ? "ring-primary" : "ring-transparent"
              )}
            >
              <ProductImage
                src={img.url}
                alt={img.alt}
                label={name}
                sizes="20vw"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
