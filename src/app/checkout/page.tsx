import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

// Placeholder — the full checkout (shipping form, Razorpay) is the next
// Milestone 5 stage. Kept so cart CTAs resolve rather than 404.
export default function CheckoutPage() {
  return (
    <section className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
        Checkout
      </p>
      <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
        Secure checkout is on its way
      </h1>
      <p className="mt-3 text-muted-foreground">
        Online payment is being set up. In the meantime, you can place your order
        with us directly on WhatsApp — we&rsquo;ll confirm everything personally.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/cart">Back to bag</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </div>
    </section>
  );
}
