"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BrandLogo } from "@/components/brand/brand-logo";
import { categories, mainNav } from "@/lib/site-config";

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll, move focus into the drawer, and trap Tab + Escape while open.
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/40 md:hidden"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-sm flex-col bg-background md:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <BrandLogo variant="horizontal" className="h-7" />
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-md p-1 text-foreground"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6">
              <p className="px-2 text-xs uppercase tracking-wider text-muted-foreground">
                Shop
              </p>
              <div className="mt-2 flex flex-col">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/shop/${cat.slug}`}
                    onClick={onClose}
                    className="rounded-md px-2 py-3 font-display text-lg text-foreground hover:bg-secondary"
                  >
                    {cat.name}
                  </Link>
                ))}
                <Link
                  href="/shop"
                  onClick={onClose}
                  className="rounded-md px-2 py-3 text-sm font-medium text-accent"
                >
                  Shop all products →
                </Link>
              </div>

              <div className="mt-6 border-t border-border pt-6">
                {mainNav
                  .filter((item) => item.label !== "Shop")
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="block rounded-md px-2 py-3 text-base text-foreground hover:bg-secondary"
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
