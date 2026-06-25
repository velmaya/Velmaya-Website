import { InstagramIcon } from "@/components/brand/icons";
import { instagramLink, siteConfig } from "@/lib/site-config";
import { ProductImage } from "@/components/product/product-image";

// Static grid placeholder. A live Instagram Basic Display / oEmbed feed is
// wired in Milestone 6 (integrations); for now this links out to the profile
// and holds the exact layout so the swap is drop-in.
export function InstagramFeed() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <InstagramIcon className="h-6 w-6 text-accent" />
        <h2 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
          @{siteConfig.contact.instagram}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Follow along for new drops, styling and behind the scenes.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <a
            key={i}
            href={instagramLink()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Instagram"
          >
            <ProductImage label="Instagram" alt="Velmaya on Instagram" />
          </a>
        ))}
      </div>
    </section>
  );
}
