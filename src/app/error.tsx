"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to the console in dev; wire to error monitoring in a later phase.
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <BrandLogo variant="icon" alt="" className="h-14 opacity-40" />
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">
        Something went wrong
      </p>
      <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
        A small hiccup on our end
      </h1>
      <p className="mt-3 text-muted-foreground">
        Please try again. If it keeps happening, reach us on WhatsApp or
        Instagram and we&rsquo;ll help right away.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </section>
  );
}
