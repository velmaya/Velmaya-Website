import Link from "next/link";
import { Truck, RefreshCcw, ShieldCheck } from "lucide-react";

// Compact reassurance row shown directly under the PDP buy action — the
// standard delivery / exchange / trust signals expected on a premium PDP.
const items = [
  {
    icon: Truck,
    title: "Shipped across India",
    body: "Dispatched in 1–3 days, free over ₹1499.",
    href: "/policies/shipping",
  },
  {
    icon: RefreshCcw,
    title: "Easy size exchange",
    body: "7-day exchange on unworn items.",
    href: "/policies/returns",
  },
  {
    icon: ShieldCheck,
    title: "Ordered with care",
    body: "Confirmed personally over WhatsApp.",
    href: "/faq",
  },
];

export function PdpTrust() {
  return (
    <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
      {items.map((item) => (
        <li key={item.title}>
          <Link
            href={item.href}
            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary"
          >
            <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <span className="text-sm">
              <span className="font-medium text-foreground">{item.title}</span>
              <span className="ml-1 text-muted-foreground">— {item.body}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
