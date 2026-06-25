"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "@/components/brand/icons";
import { Field } from "@/components/checkout/field";
import { useCart } from "@/components/cart/cart-provider";
import {
  prepareCheckout,
  placeOrder,
  confirmPayment,
} from "@/lib/checkout/actions";
import { openRazorpayCheckout } from "@/lib/razorpay/checkout-client";
import {
  emptyShipping,
  validateShipping,
  type ShippingValues,
  type ShippingErrors,
  type RepricedCart,
} from "@/lib/checkout/schema";
import { formatINR } from "@/lib/products";
import { whatsappLink } from "@/lib/site-config";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "paying" }
  | { kind: "unavailable"; orderSummary: string }
  | { kind: "placed"; orderNumber: string }
  | { kind: "error"; message: string };

export function CheckoutClient() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [cart, setCart] = useState<RepricedCart | null>(null);
  const [values, setValues] = useState<ShippingValues>(emptyShipping);
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  // Authoritative server-side reprice whenever the cart contents change.
  useEffect(() => {
    let active = true;
    if (items.length === 0) {
      setCart(null);
      setStatus({ kind: "ready" });
      return;
    }
    setStatus({ kind: "loading" });
    prepareCheckout(items).then((priced) => {
      if (!active) return;
      setCart(priced);
      setStatus({ kind: "ready" });
    });
    return () => {
      active = false;
    };
  }, [items]);

  function set(field: keyof ShippingValues, v: string) {
    setValues((prev) => ({ ...prev, [field]: v }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateShipping(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document
        .querySelector('[aria-invalid="true"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    setStatus({ kind: "submitting" });
    const result = await placeOrder({ items, shipping: values });

    if (result.ok) {
      await launchPayment(result);
      return;
    }
    switch (result.reason) {
      case "invalid":
        setErrors(result.errors);
        setStatus({ kind: "ready" });
        break;
      case "stock_changed":
        setCart(result.cart);
        setStatus({ kind: "error", message: "stock_changed" });
        break;
      case "checkout_unavailable":
        setStatus({ kind: "unavailable", orderSummary: buildWhatsappOrder() });
        break;
      case "empty":
        setStatus({ kind: "error", message: "Your bag is empty." });
        break;
      default:
        setStatus({ kind: "error", message: result.message });
    }
  }

  async function launchPayment(order: {
    orderId: string;
    orderNumber: string;
    razorpayOrderId: string;
    amountPaise: number;
  }) {
    setStatus({ kind: "paying" });
    const { launched } = await openRazorpayCheckout({
      razorpayOrderId: order.razorpayOrderId,
      amountPaise: order.amountPaise,
      prefill: {
        name: values.fullName,
        email: values.email || undefined,
        contact: values.phone,
      },
      onSuccess: async (r) => {
        const confirmed = await confirmPayment({
          orderId: order.orderId,
          razorpayOrderId: r.razorpay_order_id,
          razorpayPaymentId: r.razorpay_payment_id,
          signature: r.razorpay_signature,
        });
        if (confirmed.ok) {
          clear();
          router.push(
            `/checkout/confirmation?order=${encodeURIComponent(confirmed.orderNumber)}`
          );
        } else {
          setStatus({ kind: "error", message: confirmed.message });
        }
      },
      onDismiss: () => setStatus({ kind: "ready" }),
    });
    if (!launched) {
      setStatus({
        kind: "error",
        message:
          "Payment couldn't be started. Please try again, or order on WhatsApp.",
      });
    }
  }

  function buildWhatsappOrder() {
    const lines = (cart?.lines ?? [])
      .filter((l) => l.qty > 0)
      .map((l) => `• ${l.productName} (${l.size}) ×${l.qty} — ${formatINR(l.lineTotal)}`)
      .join("\n");
    return (
      `Hi Velmaya! I'd like to place this order:\n${lines}\n` +
      `Subtotal: ${formatINR(cart?.subtotal ?? subtotal)}\n` +
      `Ship to: ${values.fullName}, ${values.addressLine1}${
        values.addressLine2 ? ", " + values.addressLine2 : ""
      }, ${values.city}, ${values.state} - ${values.pincode}\n` +
      `Phone: ${values.phone}`
    );
  }

  // ---- Empty bag ----
  if (items.length === 0 && status.kind !== "placed") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-5 font-display text-3xl text-foreground">
          Your bag is empty
        </h1>
        <p className="mt-2 text-muted-foreground">
          Add a piece or two before checking out.
        </p>
        <Button asChild className="mt-6">
          <Link href="/shop">Browse the shop</Link>
        </Button>
      </div>
    );
  }

  // ---- Order placed (pre-payment; Razorpay handoff is the next stage) ----
  if (status.kind === "placed") {
    return (
      <div
        role="status"
        className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center"
      >
        <h1 className="font-display text-3xl text-foreground">
          Order {status.orderNumber} created
        </h1>
        <p className="mt-3 text-muted-foreground">
          Your items are reserved. Secure online payment opens in the next step —
          we&rsquo;ll guide you through it.
        </p>
        <Button asChild className="mt-6">
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  const purchasable = (cart?.lines ?? []).filter((l) => l.qty > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground sm:text-4xl">
        Checkout
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        {/* shipping form */}
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <h2 className="font-display text-xl text-foreground">
            Shipping details
          </h2>

          <Field id="fullName" label="Full name" required value={values.fullName}
            onChange={(v) => set("fullName", v)} error={errors.fullName}
            autoComplete="name" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="phone" label="Mobile number" required type="tel"
              value={values.phone} onChange={(v) => set("phone", v)}
              error={errors.phone} autoComplete="tel" placeholder="10-digit mobile" />
            <Field id="email" label="Email" type="email" value={values.email}
              onChange={(v) => set("email", v)} error={errors.email}
              autoComplete="email" hint="For your order confirmation." />
          </div>
          <Field id="addressLine1" label="Address" required
            value={values.addressLine1} onChange={(v) => set("addressLine1", v)}
            error={errors.addressLine1} autoComplete="address-line1"
            placeholder="House no., street" />
          <Field id="addressLine2" label="Apartment, landmark"
            value={values.addressLine2} onChange={(v) => set("addressLine2", v)}
            error={errors.addressLine2} autoComplete="address-line2" />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="city" label="City" required value={values.city}
              onChange={(v) => set("city", v)} error={errors.city}
              autoComplete="address-level2" />
            <Field id="state" label="State" required value={values.state}
              onChange={(v) => set("state", v)} error={errors.state}
              autoComplete="address-level1" />
            <Field id="pincode" label="PIN code" required value={values.pincode}
              onChange={(v) => set("pincode", v)} error={errors.pincode}
              autoComplete="postal-code" placeholder="6 digits" />
          </div>
          <Field id="orderNotes" label="Order notes" textarea maxLength={500}
            value={values.orderNotes} onChange={(v) => set("orderNotes", v)}
            error={errors.orderNotes} placeholder="Anything we should know?" />
          <Field id="giftMessage" label="Gift message" textarea maxLength={200}
            value={values.giftMessage} onChange={(v) => set("giftMessage", v)}
            error={errors.giftMessage} placeholder="We can include a note in the parcel." />

          {status.kind === "error" && status.message !== "stock_changed" && (
            <p role="alert" className="text-sm text-destructive">
              {status.message}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full"
            disabled={
              status.kind === "submitting" ||
              status.kind === "loading" ||
              status.kind === "paying"
            }>
            {status.kind === "submitting"
              ? "Placing order…"
              : status.kind === "paying"
                ? "Opening secure payment…"
                : "Pay securely"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Secure payment via Razorpay. You can also order on WhatsApp.
          </p>
        </form>

        {/* order summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-xl text-foreground">Order summary</h2>

            {status.kind === "loading" || !cart ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {cart.hasChanges && (
                  <p role="alert" className="mt-3 rounded-md bg-secondary p-3 text-sm text-foreground">
                    Some items changed since you added them — the updated prices
                    and quantities are shown below.
                  </p>
                )}
                <ul className="mt-4 space-y-3">
                  {purchasable.map((l) => (
                    <li key={l.variantId} className="flex justify-between gap-3 text-sm">
                      <span className="text-foreground">
                        {l.productName}{" "}
                        <span className="text-muted-foreground">
                          ({l.size}) ×{l.qty}
                        </span>
                        {l.status === "qty_reduced" && (
                          <span className="block text-xs text-accent">
                            Only {l.available} available
                          </span>
                        )}
                        {l.status === "price_changed" && (
                          <span className="block text-xs text-accent">
                            Price updated
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-foreground">
                        {formatINR(l.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="text-foreground">{formatINR(cart.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="text-foreground">
                      {cart.shippingFee === 0 ? "Free" : formatINR(cart.shippingFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-medium">
                    <dt className="text-foreground">Total</dt>
                    <dd className="font-display text-lg text-foreground">
                      {formatINR(cart.total)}
                    </dd>
                  </div>
                </dl>
              </>
            )}

            {/* graceful fallback if online checkout isn't connected yet */}
            {status.kind === "unavailable" && (
              <div className="mt-5 rounded-md bg-secondary p-4 text-sm">
                <p className="text-foreground">
                  Online payment is being finalised. Send this order on WhatsApp
                  and we&rsquo;ll confirm everything personally.
                </p>
                <Button asChild variant="accent" className="mt-3 w-full">
                  <a href={whatsappLink(status.orderSummary)} target="_blank"
                    rel="noopener noreferrer">
                    <WhatsappIcon className="h-5 w-5" />
                    Send order on WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>

          <Link href="/cart" className="mt-4 block text-center text-sm text-accent underline">
            Edit your bag
          </Link>
        </aside>
      </div>
    </div>
  );
}
