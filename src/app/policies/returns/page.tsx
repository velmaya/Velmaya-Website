import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Prose } from "@/components/layout/prose";

export const metadata: Metadata = {
  title: "Return & Exchange Policy",
  description: "How returns and exchanges work at Velmaya.",
};

export default function ReturnsPage() {
  return (
    <>
      <PageHeader eyebrow="Support" title="Return & Exchange Policy" />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Prose>
          <p className="text-sm text-muted-foreground">Last updated: [DATE]</p>
          <p>
            We want you to love what you order. If something isn&rsquo;t right,
            here&rsquo;s how returns and exchanges work.
          </p>

          <h2>Eligibility</h2>
          <ul>
            <li>Returns/exchanges must be requested within [7] days of delivery.</li>
            <li>Items must be unworn, unwashed, with original tags and packaging.</li>
            <li>Items marked &ldquo;Final Sale&rdquo; are not eligible.</li>
          </ul>

          <h2>Size Exchanges</h2>
          <p>
            If a size doesn&rsquo;t fit, message us on WhatsApp with your order
            number — we&rsquo;ll check stock for your size and arrange an
            exchange where possible.
          </p>

          <h2>Returns for Refund</h2>
          <ul>
            <li>
              Once we receive and inspect the returned item, refunds are
              processed to your original payment method via Razorpay within
              [5–7] business days.
            </li>
            <li>
              Return shipping costs are [borne by the customer / covered by
              Velmaya for defective items] — to be confirmed before launch.
            </li>
          </ul>

          <h2>Damaged or Incorrect Items</h2>
          <p>
            If you receive a damaged, defective, or incorrect item, contact us
            within [48 hours] of delivery with photos, and we&rsquo;ll arrange a
            replacement or refund at no extra cost.
          </p>

          <h2>How to Start a Return/Exchange</h2>
          <ol>
            <li>Message us on WhatsApp or email with your order number and reason.</li>
            <li>We&rsquo;ll confirm eligibility and share return instructions.</li>
            <li>Ship the item back; once received and inspected, we process your exchange or refund.</li>
          </ol>

          <h2>A Note on Sizing</h2>
          <p>
            Before requesting a size exchange, please check the size guide on
            each product page — it&rsquo;s there to help you choose right the
            first time.
          </p>
        </Prose>
      </section>
    </>
  );
}
