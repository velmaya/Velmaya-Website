"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, ShoppingBag, Search } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { MegaMenu } from "@/components/layout/mega-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { mainNav } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/* announcement strip */}
      <div className="bg-primary px-4 py-2 text-center text-xs tracking-wide text-primary-foreground">
        Free shipping over ₹1499 · Sizes XS&ndash;2XL · Easy WhatsApp support
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* left: mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center rounded-md p-1 text-foreground md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* center-left: logo */}
        <Link href="/" className="md:flex-none" aria-label="Velmaya home">
          <BrandLogo variant="horizontal" priority className="h-6 md:h-8" />
        </Link>

        {/* center: desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <MegaMenu />
          {mainNav
            .filter((item) => item.label !== "Shop")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
        </nav>

        {/* right: icons */}
        <div className="flex items-center gap-1">
          <Link
            href="/shop"
            aria-label="Search"
            className={cn("rounded-md p-2 text-foreground/80 hover:text-foreground")}
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="rounded-md p-2 text-foreground/80 hover:text-foreground"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
