"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-secondary">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        {/* copy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-xl"
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            The Launch Edit
          </span>
          <h1 className="mt-5 font-display text-4xl leading-tight text-foreground sm:text-5xl lg:text-6xl">
            Ethnic wear made for the ordinary, beautiful day.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Kurtis, kurti sets and co-ords cut from fabric we chose ourselves —
            in sizes XS to 2XL, charted to actually fit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/shop">Shop the Edit</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/our-story">Our Story</Link>
            </Button>
          </div>
        </motion.div>

        {/* visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-muted to-primary/20" />
            <div className="mt-8 aspect-[3/4] rounded-2xl bg-gradient-to-br from-primary/15 to-accent/20" />
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <BrandLogo variant="icon" alt="" className="h-20 opacity-20" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
