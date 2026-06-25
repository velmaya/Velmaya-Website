import Image from "next/image";
import { cn } from "@/lib/utils";

// Single source of truth for rendering the official Velmaya logo. Every logo on
// the site goes through this component, so a future asset change is a one-file
// edit. Assets live in public/brand and are the ONLY approved logo files — never
// recreate, inline, or redraw the mark.
//
// Variant → asset (with intrinsic dimensions, so <Image> keeps exact proportions).
// We use the "-fit" / mark files: the official artwork with its heavy transparent
// padding trimmed (see scripts/prepare-logos.mjs) so height-based sizing renders
// the logo at a readable, premium size. Pristine originals live alongside.
//   horizontal → logo-horizontal-fit.png  (mark + wordmark, row)    — light bg
//   stacked    → logo-stacked-fit.png      (mark over wordmark)      — light bg
//   icon       → logo-mark.png             (lotus mark only)         — light bg
//   reversed   → logo-reversed-fit.png     (white, mark+wordmark)    — dark bg

const ASSETS = {
  horizontal: { src: "/brand/logo-horizontal-fit.png", width: 1666, height: 324 },
  stacked: { src: "/brand/logo-stacked-fit.png", width: 857, height: 414 },
  icon: { src: "/brand/logo-mark.png", width: 510, height: 542 },
  reversed: { src: "/brand/logo-reversed-fit.png", width: 1271, height: 738 },
} as const;

export type BrandLogoVariant = keyof typeof ASSETS;

export function BrandLogo({
  variant = "horizontal",
  className,
  priority = false,
  alt = "Velmaya",
}: {
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
  /** Pass "" for decorative usage (hidden from assistive tech). */
  alt?: string;
}) {
  const asset = ASSETS[variant];
  return (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={alt}
      priority={priority}
      aria-hidden={alt === "" ? true : undefined}
      // Caller sets height (e.g. `h-9`); width stays auto to preserve ratio.
      className={cn("w-auto", className)}
    />
  );
}
