import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Leaderboard",
  description:
    "See who's dominating the AlternaPick leaderboard. Daily, weekly, and all-time rankings across player prop predictions.",
  path: "/leaderboard",
});

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
