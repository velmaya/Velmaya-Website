import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "@/components/brand/icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { whatsappLink } from "@/lib/site-config";
import { formatINR } from "@/lib/products";

export const metadata: Metadata = { title: "Order Confirmation" };
export const dynamic = "force-dynamic";

function supabaseConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;

  let order: { status: string; total: number } | null = null;
  if (orderNumber && supabaseConfigured()) {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("orders")
      .select("status, total")
      .eq("order_number", orderNumber)
      .single();
    if (data) order = data;
  }

  const paid = order?.status === "paid";
  const failed =
    order?.status === "payment_failed" || order?.status === "cancelled";

  const Icon = paid ? CheckCircle2 : failed ? XCircle : Clock;
  const heading = paid
    ? "Thank you — your order is confirmed"
    : failed
      ? "Payment didn't go through"
      : "We're confirming your payment";

  const support = whatsappLink(
    `Hi Velmaya! A question about my order ${orderNumber ?? ""}.`
  );

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <Icon
        className={
          paid
            ? "h-12 w-12 text-accent"
            : failed
              ? "h-12 w-12 text-destructive"
              : "h-12 w-12 text-muted-foreground"
        }
      />
      <h1 className="mt-5 font-display text-3xl text-foreground">{heading}</h1>

      {orderNumber && (
        <p className="mt-3 text-muted-foreground">
          Order <span className="font-medium text-foreground">{orderNumber}</span>
          {order ? (
            <>
              {" · "}
              {formatINR(order.total)}
            </>
          ) : null}
        </p>
      )}

      <p className="mt-4 max-w-md text-muted-foreground">
        {paid
          ? "We've reserved your pieces and will share tracking once they ship. A confirmation is on its way to you."
          : failed
            ? "No payment was taken, and any held stock has been released. You're welcome to try again or order on WhatsApp."
            : "This can take a few moments. If it doesn't update, refresh — or message us and we'll check it for you."}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {paid ? (
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href={failed ? "/cart" : "/checkout"}>
              {failed ? "Back to bag" : "Refresh status"}
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <a href={support} target="_blank" rel="noopener noreferrer">
            <WhatsappIcon className="h-5 w-5" />
            Chat with us
          </a>
        </Button>
      </div>
    </section>
  );
}
