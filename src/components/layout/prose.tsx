import { cn } from "@/lib/utils";

// Lightweight prose styles for policy/long-form pages without pulling in the
// typography plugin. Styles common child elements via arbitrary variants.
export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-foreground/85 leading-relaxed",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-foreground",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-foreground",
        "[&_p]:my-4",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1.5",
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
