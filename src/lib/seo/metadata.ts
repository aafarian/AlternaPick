/**
 * Shared SEO / robots metadata helpers.
 */

import type { Metadata } from "next";

/**
 * Marks a route as `noindex, nofollow`. Use this on personal/account
 * routes (settings, profile, notifications, picks dashboard, etc.) where
 * Googlebot would only see a login prompt or empty state — there's
 * nothing useful to index, so it's a waste of crawl budget and dilutes
 * ranking signals away from the marketing pages.
 *
 * Apply via `export const metadata = noIndexMetadata` in the route's
 * `page.tsx`, or in a parent `layout.tsx` to cascade.
 */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
