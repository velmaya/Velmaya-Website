"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { categories } from "@/lib/site-config";

export function MegaMenu() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when focus leaves the whole menu (keyboard tab-out) or on Escape.
  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <Link
        href="/shop"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="shop-megamenu"
        className="flex items-center gap-1 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
      >
        Shop
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Link>

      <AnimatePresence>
        {open && (
          <motion.div
            id="shop-megamenu"
            role="region"
            aria-label="Shop categories"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full z-50 w-[640px] -translate-x-1/2 pt-4"
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-popover p-4 shadow-lg">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/shop/${cat.slug}`}
                  onClick={() => setOpen(false)}
                  className="group rounded-lg p-4 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                >
                  <div className="font-display text-base text-popover-foreground">
                    {cat.name}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cat.blurb}
                  </p>
                </Link>
              ))}
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="col-span-2 rounded-lg bg-secondary px-4 py-3 text-center text-sm font-medium text-secondary-foreground transition-opacity hover:opacity-80"
              >
                Shop all products →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
