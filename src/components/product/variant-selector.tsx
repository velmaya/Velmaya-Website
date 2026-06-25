"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsappIcon } from "@/components/brand/icons";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/site-config";
import {
  type Product,
  effectivePrice,
  formatINR,
  isOnSale,
} from "@/lib/products";

const LOW_STOCK_THRESHOLD = 3;

export function VariantSelector({ product }: { product: Product }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSizeHint, setShowSizeHint] = useState(false);
  const selected = product.variants.find((v) => v.id === selectedId) ?? null;
  const onSale = isOnSale(product);
  const { addItem } = useCart();

  function addToBag() {
    if (!selected) {
      setShowSizeHint(true);
      return;
    }
    const image = product.images[0];
    addItem({
      variantId: selected.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      size: selected.size,
      unitPrice: effectivePrice(selected),
      imageUrl: image?.url,
      imageAlt: image?.alt ?? product.name,
      qty: 1,
    });
  }

  const orderMessage = selected
    ? `Hi Velmaya! I'd like to order the ${product.name} in size ${selected.size} (${formatINR(effectivePrice(selected))}). SKU: ${selected.sku}`
    : `Hi Velmaya! I'm interested in the ${product.name}.`;

  return (
    <div>
      {/* price */}
      <div className="flex items-center gap-3">
        {selected ? (
          <>
            <span className="font-display text-2xl text-foreground">
              {formatINR(effectivePrice(selected))}
            </span>
            {selected.salePrice != null &&
              selected.salePrice < selected.price && (
                <span className="text-base text-muted-foreground line-through">
                  {formatINR(selected.price)}
                </span>
              )}
          </>
        ) : (
          <span className="font-display text-2xl text-foreground">
            {formatINR(product.basePrice)}
            {onSale && (
              <Badge variant="accent" className="ml-3 align-middle">
                Sale
              </Badge>
            )}
          </span>
        )}
      </div>

      {/* size selector */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Select size
          </span>
          <Link
            href="/faq"
            className="text-sm text-accent underline underline-offset-2"
          >
            Size guide
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {product.variants.map((v) => {
            const out = v.stockQty === 0;
            const active = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                disabled={out}
                onClick={() => {
                  setSelectedId(v.id);
                  setShowSizeHint(false);
                }}
                className={cn(
                  "min-w-12 rounded-md border px-4 py-2.5 text-sm transition-colors",
                  out &&
                    "cursor-not-allowed border-border text-muted-foreground line-through opacity-50",
                  !out &&
                    active &&
                    "border-primary bg-primary text-primary-foreground",
                  !out &&
                    !active &&
                    "border-border text-foreground hover:border-primary"
                )}
              >
                {v.size}
              </button>
            );
          })}
        </div>

        {selected && selected.stockQty <= LOW_STOCK_THRESHOLD && (
          <p className="mt-2 text-sm text-accent">
            Only {selected.stockQty} left in {selected.size}
          </p>
        )}
        {showSizeHint && !selected && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Please select a size first.
          </p>
        )}
      </div>

      {/* actions */}
      <div className="mt-8 space-y-3">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={addToBag}
        >
          <ShoppingBag className="h-5 w-5" />
          Add to bag
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="w-full"
        >
          <a
            href={whatsappLink(orderMessage)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsappIcon className="h-5 w-5" />
            {selected ? `Order ${selected.size} on WhatsApp` : "Order on WhatsApp"}
          </a>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Prefer to order over chat? WhatsApp works too — a real person replies.
        </p>
      </div>
    </div>
  );
}
