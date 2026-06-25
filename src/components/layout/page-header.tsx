export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-secondary">
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 font-display text-4xl text-foreground sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
