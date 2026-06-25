"use client";

import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/products";
import {
  computeShippingFee,
  freeShippingRemaining,
} from "@/lib/commerce/config";

export function CartView() {
  const { items, subtotal, updateQty, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-20 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-5 font-display text-3xl text-foreground">
          Your bag is empty
        </h1>
        <p className="mt-2 text-muted-foreground">
          Add a few pieces you love and they&rsquo;ll show up here.
        </p>
        <Button asChild className="mt-6">
          <Link href="/shop">Browse the shop</Link>
        </Button>
      </div>
    );
  }

  const shipping = computeShippingFee(subtotal);
  const remaining = freeShippingRemaining(subtotal);
  const total = subtotal + shipping;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl text-foreground sm:text-4xl">
        Your bag
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* line items */}
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-4 py-5">
              <div className="w-24 shrink-0 sm:w-28">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.imageAlt}
                  label={item.productName}
                  sizes="112px"
                />
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <Link
                    href={`/product/${item.productSlug}`}
                    className="font-display text-base text-foreground hover:underline"
                  >
                    {item.productName}
                  </Link>
                  <span className="font-medium text-foreground">
                    {formatINR(item.unitPrice * item.qty)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Size {item.size} · {formatINR(item.unitPrice)} each
                </p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      onClick={() => updateQty(item.variantId, item.qty - 1)}
                      aria-label={`Decrease ${item.productName} quantity`}
                      className="p-2 text-foreground hover:bg-secondary"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-9 text-center text-sm">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.variantId, item.qty + 1)}
                      aria-label={`Increase ${item.productName} quantity`}
                      className="p-2 text-foreground hover:bg-secondary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* summary */}
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-lg text-foreground">
              Order summary
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="text-foreground">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="text-foreground">
                  {shipping === 0 ? "Free" : formatINR(shipping)}
                </dd>
              </div>
              {remaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add {formatINR(remaining)} more for free shipping.
                </p>
              )}
              <div className="flex justify-between border-t border-border pt-3 text-base">
                <dt className="font-medium text-foreground">Total</dt>
                <dd className="font-medium text-foreground">
                  {formatINR(total)}
                </dd>
              </div>
            </dl>
            <Button asChild size="lg" className="mt-5 w-full">
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Taxes included. Final total confirmed at checkout.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
