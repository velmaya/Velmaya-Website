import Link from "next/link";
import type { Product } from "@/lib/products";

// Accessible accordion (native <details>/<summary>, keyboard-friendly by default)
// holding the product information a fashion shopper looks for before buying:
// description, fabric & care, fit & sizing, and shipping & returns.

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group py-4">
      <summary className="flex cursor-pointer items-center justify-between font-display text-lg text-foreground marker:content-none">
        {title}
        <span
          aria-hidden
          className="ml-4 text-accent transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-foreground/80">
        {children}
      </div>
    </details>
  );
}

export function ProductInfo({ product }: { product: Product }) {
  return (
    <section
      aria-label="Product information"
      className="mt-8 divide-y divide-border border-t border-border"
    >
      <Section title="Description" defaultOpen>
        <p>{product.description}</p>
      </Section>

      <Section title="Fabric & care">
        <dl className="space-y-2">
          <div>
            <dt className="font-medium text-foreground">Fabric</dt>
            <dd className="text-muted-foreground">{product.fabric}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Care</dt>
            <dd className="text-muted-foreground">
              {product.careInstructions}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Fit & sizing">
        <p>
          Designed to be true to size with an easy, everyday fit. Available in
          sizes <strong className="text-foreground">XS–2XL</strong>, charted
          around real proportions rather than scaled up as an afterthought.
        </p>
        <p className="mt-2">
          Between sizes or unsure? Check the{" "}
          <Link
            href="/faq"
            className="text-accent underline underline-offset-2"
          >
            size guide
          </Link>{" "}
          or message us your measurements on WhatsApp and we&rsquo;ll recommend
          the right size before you order.
        </p>
      </Section>

      <Section title="Shipping & returns">
        <p>
          Dispatched within 1–3 business days; free shipping over ₹1499.
          Delivery is typically 2–4 days in Tamil Nadu and 4–7 days across the
          rest of India.
        </p>
        <p className="mt-2">
          Unworn items can be returned or exchanged within 7 days. See our{" "}
          <Link
            href="/policies/shipping"
            className="text-accent underline underline-offset-2"
          >
            shipping
          </Link>{" "}
          and{" "}
          <Link
            href="/policies/returns"
            className="text-accent underline underline-offset-2"
          >
            returns
          </Link>{" "}
          policies for full details.
        </p>
      </Section>
    </section>
  );
}
