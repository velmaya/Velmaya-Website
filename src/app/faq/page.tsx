import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { faqs } from "@/lib/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { faqSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Velmaya sizing, fabric, shipping, returns, and payment.",
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqSchema(faqs)} />
      <PageHeader
        eyebrow="Help"
        title="Frequently asked questions"
        subtitle="Sizing, fabric, shipping and more. Still unsure? We're a message away."
      />

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="divide-y divide-border">
          {faqs.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between font-display text-lg text-foreground marker:content-none">
                {item.q}
                <span className="ml-4 text-accent transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-foreground/80">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-secondary p-8 text-center">
          <h2 className="font-display text-2xl text-foreground">
            Still have a question?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Message us on WhatsApp or Instagram — a real person will reply.
          </p>
          <Button asChild className="mt-5">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
