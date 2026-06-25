import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cart",
};

// Placeholder cart for Milestone 3. Full cart + Razorpay checkout is Milestone 5.
export default function CartPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <ShoppingBag className="h-10 w-10 text-muted-foreground" />
      <h1 className="mt-5 font-display text-3xl text-foreground">
        Your cart is empty
      </h1>
      <p className="mt-2 text-muted-foreground">
        Checkout opens with our first collection. Have a look around in the
        meantime.
      </p>
      <Button asChild className="mt-6">
        <Link href="/shop">Browse the shop</Link>
      </Button>
    </section>
  );
}
