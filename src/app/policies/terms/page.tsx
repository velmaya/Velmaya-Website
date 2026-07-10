import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Prose } from "@/components/layout/prose";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing your use of and purchases from Velmaya.",
};

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms & Conditions" />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Prose>
          <p className="text-sm text-muted-foreground">Last updated: [DATE]</p>
          <p>
            By accessing or purchasing from shopvelmaya.com, you agree to the
            following terms.
          </p>

          <h2>About Velmaya</h2>
          <p>
            Velmaya is a women&rsquo;s ethnic-wear brand based in Tamil Nadu,
            India, registered under GST [GSTIN]. Trademark registration:
            [REGISTRATION NUMBER].
          </p>

          <h2>Products</h2>
          <ul>
            <li>
              All products are subject to availability. Stock per size is shown
              on each product page and may sell out.
            </li>
            <li>
              We make reasonable efforts to display colors and details
              accurately; minor variation may occur due to screens, dyeing
              batches, and finishing processes.
            </li>
            <li>Prices are in INR and inclusive of applicable taxes unless stated otherwise.</li>
          </ul>

          <h2>Orders &amp; Payment</h2>
          <ul>
            <li>Orders are placed through our checkout and paid via Razorpay.</li>
            <li>
              An order is confirmed only once payment is successfully verified.
              Until then, inventory is held temporarily and may be released if
              payment is not completed.
            </li>
            <li>
              We reserve the right to cancel an order in cases of pricing
              errors, stock unavailability, or suspected fraud — a full refund
              is issued in such cases.
            </li>
          </ul>

          <h2>Shipping, Returns &amp; Exchanges</h2>
          <p>
            See our <a href="/policies/shipping">Shipping Policy</a> and{" "}
            <a href="/policies/returns">Return / Exchange Policy</a>.
          </p>

          <h2>Intellectual Property</h2>
          <p>
            The Velmaya name, logo, and all site content are the property of
            Velmaya and may not be reproduced without permission.
          </p>

          <h2>Limitation of Liability</h2>
          <p>
            Velmaya is not liable for indirect or incidental damages arising
            from use of the site or products, to the maximum extent permitted by
            applicable Indian law.
          </p>

          <h2>Governing Law</h2>
          <p>
            These terms are governed by the laws of India, with jurisdiction in
            Tamil Nadu courts.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms: {siteConfig.contact.email} or via the{" "}
            <a href="/contact">Contact page</a>.
          </p>
        </Prose>
      </section>
    </>
  );
}
