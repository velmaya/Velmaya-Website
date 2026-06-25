import { Hero } from "@/components/home/hero";
import { TrustStrip } from "@/components/home/trust-strip";
import { FeaturedCategories } from "@/components/home/featured-categories";
import { StoryTeaser } from "@/components/home/story-teaser";
import { Testimonials } from "@/components/home/testimonials";
import { InstagramFeed } from "@/components/home/instagram-feed";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <FeaturedCategories />
      <StoryTeaser />
      <Testimonials />
      <InstagramFeed />
    </>
  );
}
