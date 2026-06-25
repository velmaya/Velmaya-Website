import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product/product-image";
import {
  type Product,
  priceRange,
  isOnSale,
  totalStock,
  formatINR,
} from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const { min, max } = priceRange(product);
  const onSale = isOnSale(product);
  const soldOut = totalStock(product) === 0;
  const primary = product.images[0];

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative">
        <ProductImage
          src={primary?.url}
          alt={primary?.alt ?? product.name}
          label={product.name}
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {onSale && !soldOut && <Badge variant="accent">Sale</Badge>}
          {soldOut && <Badge variant="secondary">Sold out</Badge>}
        </div>
      </div>

      <div className="mt-3">
        <h3 className="font-display text-base text-foreground">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {min === max
            ? formatINR(min)
            : `${formatINR(min)} – ${formatINR(max)}`}
        </p>
      </div>
    </Link>
  );
}
