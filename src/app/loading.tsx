import { BrandLogo } from "@/components/brand/brand-logo";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-20">
      <BrandLogo
        variant="icon"
        alt="Loading"
        className="h-12 animate-pulse opacity-60"
      />
    </div>
  );
}
