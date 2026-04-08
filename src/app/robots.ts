import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Allow everything by default, then re-allow public sub-routes
      // before disallowing the personal/account roots. Order matters:
      // robots.txt evaluates Allow vs Disallow by specificity, so the
      // longer (more specific) Allow wins for /picks/share/* even
      // though /picks is disallowed.
      allow: [
        "/",
        "/picks/share/",
      ],
      // Defense-in-depth: each of these routes also sets
      // metadata.robots = { index: false } in code, which is the
      // primary mechanism (it can de-index already-crawled pages).
      // Disallow here just keeps polite crawlers from wasting requests.
      disallow: [
        "/admin",
        "/auth",
        "/settings",
        "/profile",
        "/notifications",
        "/activity",
        "/picks",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
