/**
 * Helpers for building per-route page metadata. Centralises canonical URL
 * construction and OG block generation so individual pages stay short and
 * consistent.
 */

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

/**
 * Build an absolute canonical URL from a path. Strips trailing slashes
 * (except the root) so query-param duplicates don't compete.
 */
export function canonicalUrl(path: string): string {
  if (!path || path === "/") return SITE_URL;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean.replace(/\/+$/, "")}`;
}

interface PageMetadataOptions {
  /** Page-specific title (will be templated as `${title} | AlternaPick`) */
  title: string;
  /** Page-specific description (~160 chars max) */
  description: string;
  /** Path on this site, e.g. "/leaderboard" */
  path: string;
  /** Optional override for the OG image (relative path or absolute URL) */
  ogImage?: string;
}

/**
 * Build a complete `metadata` object for a page with title, description,
 * canonical URL, and OG/Twitter overrides.
 *
 * The root layout sets `title.template = "%s | AlternaPick"`, so the
 * `title` here is just the page-specific portion (e.g. "Leaderboard").
 */
export function buildPageMetadata({
  title,
  description,
  path,
  ogImage,
}: PageMetadataOptions): Metadata {
  const url = canonicalUrl(path);
  const image = ogImage ?? "/og-image.png";

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "AlternaPick",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
