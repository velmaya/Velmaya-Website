import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Why Velmaya exists — everyday ethnic wear made with chosen fabric, considered batches, and fit built for XS to 2XL.",
};

const values = [
  {
    title: "Fit for every body",
    body: "XS to 2XL is our baseline, not an afterthought. Every style is charted around real proportions.",
  },
  {
    title: "Fabric we stand behind",
    body: "We choose our fabric ourselves from Surat and Coimbatore — for how it feels and wears, not just what it costs.",
  },
  {
    title: "Small, considered batches",
    body: "We make in limited runs so quality control stays tight and nothing feels mass-produced.",
  },
  {
    title: "A direct relationship",
    body: "Questions reach a real person on WhatsApp or Instagram — not a ticket queue.",
  },
];

export default function OurStoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Why Velmaya"
        title="Everyday ethnic wear, made with care"
        subtitle="We started Velmaya because everyday ethnic wear too often asks you to settle — on fabric, on fit, or on price."
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="space-y-6 text-lg leading-relaxed text-foreground/85">
          <p>
            Walk through most ethnic-wear options and you&rsquo;ll find two
            extremes. On one side, fast-fashion kurtis that look generic and
            wear thin after a few washes. On the other, designer pieces priced
            for occasions and saved for the back of the wardrobe. And somewhere
            in between, sizing that shifts from brand to brand — with fit treated
            as an afterthought once you go past a certain size.
          </p>
          <p>
            Velmaya is our answer to that gap. We design kurtis, kurti sets,
            short kurtis and co-ord sets meant to be worn on an ordinary day —
            cut from fabric we choose ourselves, finished in small, considered
            batches, and charted properly across XS to 2XL.
          </p>
          <p>
            We&rsquo;re based in Tamil Nadu, and we&rsquo;re building this
            slowly and deliberately — one collection at a time, with fabric
            sourced from Surat and Coimbatore and quality we can stand behind.
            Not the cheapest, not occasion-only. Just ethnic wear that makes you
            feel like yourself, every day.
          </p>
        </div>

        <div className="my-12 flex justify-center">
          <BrandLogo variant="icon" alt="" className="h-16 opacity-40" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h2 className="font-display text-xl text-foreground">
                {v.title}
              </h2>
              <p className="mt-2 text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link href="/shop">Explore the collection</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
