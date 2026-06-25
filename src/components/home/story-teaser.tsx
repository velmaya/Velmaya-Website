import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";

export function StoryTeaser() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="relative order-2 lg:order-1">
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary-foreground/10 to-accent/30" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <BrandLogo variant="reversed" alt="" className="h-24 opacity-40" />
          </div>
        </div>

        <div className="order-1 max-w-xl lg:order-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/60">
            Why Velmaya
          </span>
          <h2 className="mt-4 font-display text-3xl leading-snug sm:text-4xl">
            Everyday ethnic wear shouldn&rsquo;t mean settling.
          </h2>
          <p className="mt-5 text-primary-foreground/85">
            Too often it&rsquo;s cheap and disposable, or expensive and saved
            for occasions — and fit gets treated as an afterthought above a
            certain size. We started Velmaya to do it differently: fabric chosen
            for how it feels, small and considered batches, and sizing built
            around real bodies, XS through 2XL.
          </p>
          <Button
            asChild
            variant="accent"
            size="lg"
            className="mt-8"
          >
            <Link href="/our-story">Read our story</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
