import { Ruler, Truck, MessageCircle, Sparkles } from "lucide-react";

const items = [
  {
    icon: Ruler,
    title: "XS to 2XL",
    body: "Every style, charted for real fit.",
  },
  {
    icon: Sparkles,
    title: "Chosen fabric",
    body: "Sourced ourselves from Surat & Coimbatore.",
  },
  {
    icon: Truck,
    title: "Shipped across India",
    body: "Free over ₹1499, tracked to your door.",
  },
  {
    icon: MessageCircle,
    title: "A real reply",
    body: "WhatsApp us — a person, not a queue.",
  },
];

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
