import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Prose } from "@/components/layout/prose";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Velmaya collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy Policy" />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Prose>
          <p className="text-sm text-muted-foreground">Last updated: [DATE]</p>
          <p>
            Velmaya (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
            operates velmaya.com. This Privacy Policy explains what information
            we collect, how we use it, and your rights regarding it.
          </p>

          <h2>Information We Collect</h2>
          <ul>
            <li>
              <strong>Contact details</strong>: name, email, phone number,
              shipping address — collected when you place an order, contact us,
              or join our newsletter.
            </li>
            <li>
              <strong>Order information</strong>: products purchased, order
              value, payment status. We do not store your card/UPI details —
              these are processed directly by Razorpay.
            </li>
            <li>
              <strong>Checkout activity</strong>: if you begin checkout but
              don&rsquo;t complete payment, we may retain the contact details
              and cart you entered so we can follow up about your order.
            </li>
            <li>
              <strong>Usage data</strong>: pages visited, device/browser type,
              approximate location — collected via Google Analytics and
              Microsoft Clarity to improve the site.
            </li>
          </ul>

          <h2>How We Use Your Information</h2>
          <ul>
            <li>To process and fulfil your orders, including shipping and support</li>
            <li>To respond to questions sent via WhatsApp, Instagram, or our contact form</li>
            <li>To send order confirmations and, where you&rsquo;ve opted in, updates about new collections</li>
            <li>To understand site usage and improve the shopping experience</li>
          </ul>

          <h2>How We Share Your Information</h2>
          <p>We do not sell your personal information. We share data only with:</p>
          <ul>
            <li><strong>Razorpay</strong>, to process payments securely</li>
            <li><strong>Shipping partners</strong>, to deliver your order</li>
            <li><strong>Analytics providers</strong>, in aggregated/anonymized form where possible</li>
          </ul>

          <h2>Data Storage</h2>
          <p>
            Order and account data is stored with Supabase. Product and
            marketing images are stored with Cloudflare R2. Both maintain
            industry-standard security practices.
          </p>

          <h2>Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your
            personal data by contacting us at {siteConfig.contact.email} or via
            WhatsApp. We&rsquo;ll respond within a reasonable timeframe.
          </p>

          <h2>Cookies</h2>
          <p>
            We use cookies for essential functionality (cart persistence) and
            analytics. You can control cookie preferences via your browser.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy: {siteConfig.contact.email} or via the{" "}
            <a href="/contact">Contact page</a>.
          </p>
        </Prose>
      </section>
    </>
  );
}
