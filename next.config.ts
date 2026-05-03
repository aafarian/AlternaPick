import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["resend", "@react-email/components", "@react-email/render"],
  // Keep cached pages alive in the App Router router cache for 10 minutes
  // so pressing browser back from a detail page restores the previous list
  // page from cache — including its component state, pagination, and the
  // browser's native scroll position. Default is 30s for dynamic routes.
  experimental: {
    staleTimes: {
      dynamic: 600,
      static: 600,
    },
  },
  images: {
    minimumCacheTTL: 86400, // Cache optimized images for 24 hours
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.nba.com",
        pathname: "/headshots/nba/latest/**",
      },
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
