import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description:
    "Velmaya is a women's ethnic-wear label from Tamil Nadu — kurtis, kurti sets and co-ords in sizes XS to 2XL.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Velmaya"
        subtitle="A women's ethnic-wear label from Tamil Nadu, built around fit, fabric, and an honest price."
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="space-y-6 text-lg leading-relaxed text-foreground/85">
          <p>
            Velmaya designs everyday ethnic wear for women — kurtis, kurti sets,
            short kurtis and co-ord sets — in sizes XS to 2XL. We choose our
            fabric ourselves from Surat and Coimbatore, and produce in small,
            considered batches so quality stays consistent as we grow.
          </p>
          <p>
            We believe everyday wear deserves the same care as occasion wear:
            fabric that feels good, silhouettes that flatter, and sizing that
            includes rather than excludes. We keep our relationship with
            customers direct — most questions are answered personally over
            WhatsApp or Instagram.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/our-story">Read our full story</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Get in touch</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
