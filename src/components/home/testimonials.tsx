import { Star } from "lucide-react";

// Placeholder testimonials until real customer reviews come in post-launch.
// Replace with Supabase `reviews` data once the reviews feature ships (backlog).
const testimonials = [
  {
    quote:
      "Finally a 2XL kurti that's cut properly and doesn't feel like an afterthought. The fabric is gorgeous.",
    name: "Priya R.",
    location: "Chennai",
  },
  {
    quote:
      "Ordered a co-ord set on a whim after their launch reel. Asked a sizing question on WhatsApp and got a reply in minutes.",
    name: "Anjana M.",
    location: "Coimbatore",
  },
  {
    quote:
      "The kurti set looks far more premium than what I paid. Already eyeing the next drop.",
    name: "Sneha K.",
    location: "Bengaluru",
  },
];

export function Testimonials() {
  return (
    <section className="bg-secondary">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl text-foreground sm:text-4xl">
          Worn and loved
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-card-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">
                {t.name} · {t.location}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
