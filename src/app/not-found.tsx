import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <BrandLogo variant="icon" alt="" className="h-14 opacity-40" />
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">
        Page not found
      </p>
      <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-3 text-muted-foreground">
        The link may be broken or the page may have moved. Let&rsquo;s get you
        back to something beautiful.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop">Browse the shop</Link>
        </Button>
      </div>
    </section>
  );
}
