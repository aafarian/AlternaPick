import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
    {
      url: siteUrl,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/props`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/leaderboard`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}
