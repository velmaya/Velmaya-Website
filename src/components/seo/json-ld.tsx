// Renders a JSON-LD <script>. Kept tiny and reusable; callers pass a fully-built
// schema.org object. Safe because the payload is our own serialised data.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
