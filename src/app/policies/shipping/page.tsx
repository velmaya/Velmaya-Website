import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Prose } from "@/components/layout/prose";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Velmaya shipping timelines, charges, and tracking.",
};

export default function ShippingPage() {
  return (
    <>
      <PageHeader eyebrow="Support" title="Shipping Policy" />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Prose>
          <p className="text-sm text-muted-foreground">Last updated: [DATE]</p>

          <h2>Processing Time</h2>
          <p>
            Orders are processed within [1–3] business days of payment
            confirmation. During new-collection launches, processing may take
            slightly longer — we&rsquo;ll notify you if there&rsquo;s a delay.
          </p>

          <h2>Delivery Timelines</h2>
          <ul>
            <li><strong>Tamil Nadu</strong>: [2–4] business days</li>
            <li><strong>Rest of India</strong>: [4–7] business days</li>
            <li>
              Estimates are provided by our shipping partners and may vary due
              to courier delays, weather, or regional disruptions.
            </li>
          </ul>

          <h2>Shipping Charges</h2>
          <p>
            Free shipping over ₹1499; a flat rate of [₹Y] applies below that —
            confirmed at checkout before payment.
          </p>

          <h2>Order Tracking</h2>
          <p>
            Once shipped, you&rsquo;ll receive a tracking link via
            email/WhatsApp. You can also reach us on WhatsApp for a status
            update.
          </p>

          <h2>Delivery Issues</h2>
          <p>
            If your order is delayed, lost, or arrives damaged, contact us
            within [48 hours] and we&rsquo;ll work with you to resolve it.
          </p>

          <h2>Serviceable Areas</h2>
          <p>
            We currently ship across India. International shipping is planned for
            the future.
          </p>
        </Prose>
      </section>
    </>
  );
}
