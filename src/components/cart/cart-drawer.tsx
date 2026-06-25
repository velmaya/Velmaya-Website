"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/cart/cart-provider";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/products";
import {
  commerceConfig,
  computeShippingFee,
  freeShippingRemaining,
} from "@/lib/commerce/config";

export function CartDrawer() {
  const { items, subtotal, count, isOpen, closeCart, updateQty, removeItem } =
    useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeCart]);

  const remaining = freeShippingRemaining(subtotal);
  const shipping = computeShippingFee(subtotal);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-foreground/40"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[90%] max-w-md flex-col bg-background"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg text-foreground">
                Your bag{count > 0 ? ` (${count})` : ""}
              </h2>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close bag"
                className="rounded-md p-1 text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-muted-foreground">Your bag is empty.</p>
                <Button onClick={closeCart} asChild>
                  <Link href="/shop">Browse the shop</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* free shipping progress */}
                <div className="border-b border-border px-5 py-3 text-sm">
                  {remaining > 0 ? (
                    <p className="text-muted-foreground">
                      You&rsquo;re {formatINR(remaining)} away from{" "}
                      <span className="text-foreground">free shipping</span>.
                    </p>
                  ) : (
                    <p className="text-accent">
                      You&rsquo;ve unlocked free shipping.
                    </p>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (subtotal / commerceConfig.freeShippingThreshold) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* lines */}
                <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
                  {items.map((item) => (
                    <li key={item.variantId} className="flex gap-4 py-4">
                      <div className="w-20 shrink-0">
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.imageAlt}
                          label={item.productName}
                          sizes="80px"
                        />
                      </div>
                      <div className="flex flex-1 flex-col">
                        <Link
                          href={`/product/${item.productSlug}`}
                          onClick={closeCart}
                          className="font-display text-sm text-foreground hover:underline"
                        >
                          {item.productName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Size {item.size}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-md border border-border">
                            <button
                              type="button"
                              onClick={() =>
                                updateQty(item.variantId, item.qty - 1)
                              }
                              aria-label={`Decrease ${item.productName} quantity`}
                              className="p-1.5 text-foreground hover:bg-secondary"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-8 text-center text-sm">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQty(item.variantId, item.qty + 1)
                              }
                              aria-label={`Increase ${item.productName} quantity`}
                              className="p-1.5 text-foreground hover:bg-secondary"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {formatINR(item.unitPrice * item.qty)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        aria-label={`Remove ${item.productName}`}
                        className="self-start p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* footer */}
                <div className="border-t border-border px-5 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      {formatINR(subtotal)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-foreground">
                      {shipping === 0 ? "Free" : formatINR(shipping)}
                    </span>
                  </div>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Taxes included. Calculated at checkout.
                  </p>
                  <Button asChild size="lg" className="mt-3 w-full">
                    <Link href="/checkout" onClick={closeCart}>
                      Proceed to checkout
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="mt-2 w-full"
                  >
                    <Link href="/cart" onClick={closeCart}>
                      View full bag
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
