/**
 * Renders a JSON-LD structured data block.
 *
 * Pass any schema.org-shaped object as `data`. The component serializes
 * it via JSON.stringify and writes it into a `<script type="application/ld+json">`
 * tag — the standard way Google et al. consume structured data.
 *
 * The schemas in `src/lib/seo/structured-data.ts` are static (no user
 * input), so injecting via dangerouslySetInnerHTML is safe. If a future
 * caller passes user-derived strings, they MUST be sanitized first.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
