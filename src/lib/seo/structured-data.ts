/**
 * JSON-LD structured data builders for schema.org markup.
 *
 * These help search engines understand what AlternaPick is — feeds the
 * brand sitelinks box and primes us for richer results down the road
 * (FAQ, breadcrumbs, etc.).
 *
 * Validate any changes with https://search.google.com/test/rich-results
 * before merging.
 */

import { SITE_URL } from "@/lib/constants";

const LOGO_URL = `${SITE_URL}/og-image.png`;

/**
 * Organization schema — describes the brand. Renders in the root layout
 * so it's present on every page. Search engines use this for the brand
 * knowledge panel and sitelinks.
 *
 * `sameAs` is intentionally omitted — we don't have official social
 * accounts yet. Add them once they exist (X, Instagram, TikTok, etc.).
 */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AlternaPick",
  url: SITE_URL,
  logo: LOGO_URL,
} as const;

/**
 * WebSite schema — describes the site. Renders in the root layout.
 *
 * `potentialAction` (SearchAction) is intentionally omitted — we don't
 * have a full-site search yet. Add it when there's a `/search?q=...`
 * route or similar.
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AlternaPick",
  url: SITE_URL,
} as const;

/**
 * SoftwareApplication schema — describes the product. Renders only on
 * the landing page (`/`) since that's where the marketing context lives.
 *
 * `aggregateRating` is intentionally omitted — fabricating ratings is a
 * Google penalty risk, and we don't have real review counts yet.
 */
export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlternaPick",
  url: SITE_URL,
  description:
    "Pick over/unders on real player props across NBA, college basketball, soccer, and more. Challenge friends head-to-head and climb the leaderboard. Free to play, no signup required.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
} as const;
