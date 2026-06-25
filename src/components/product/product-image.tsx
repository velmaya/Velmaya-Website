import Image from "next/image";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";

// Product imagery pipeline. Every product image is a fixed 4:5 portrait (see
// docs/02-information-architecture.md image standards). Until real photography
// from Cloudflare R2 is available, `src` may be undefined and we render a
// branded placeholder of the exact same aspect ratio — so swapping in the real
// photo later is a pure content change, no layout shift.
export function ProductImage({
  src,
  alt,
  label,
  priority,
  className,
  sizes = "(max-width: 768px) 50vw, 25vw",
}: {
  src?: string;
  alt: string;
  label?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-secondary",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 hover:scale-105"
        />
      ) : (
        <Placeholder label={label ?? alt} />
      )}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-secondary to-muted">
      <BrandLogo variant="icon" alt="" className="h-16 opacity-30" />
      <span className="px-3 text-center text-xs uppercase tracking-wider text-primary/40">
        {label}
      </span>
    </div>
  );
}
