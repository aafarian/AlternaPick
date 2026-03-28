import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/props`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}
