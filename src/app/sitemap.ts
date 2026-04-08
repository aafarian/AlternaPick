import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import { logError } from "@/lib/logger";

// Caps per CLAUDE.md rule #7 (data volume) — keep DB queries bounded.
const MAX_PROFILES = 1000;
const MAX_CHALLENGES = 1000;
const MAX_REFERRERS = 1000;

// Revalidate every hour. Sitemap doesn't need to be perfectly fresh —
// Google polls it on its own schedule.
export const revalidate = 3600;

/**
 * Dynamic sitemap that combines static marketing routes with public,
 * indexable dynamic routes pulled from Supabase.
 *
 * Excluded by design:
 * - Auth-gated routes (/picks, /profile, /settings, /notifications, etc.)
 *   are noindex'd via metadata.robots.
 * - /picks/share/[token] uses an opaque share_token — it's an "unlisted"
 *   pattern, putting tokens in a public sitemap defeats the access control.
 * - /admin, /auth — also noindex'd.
 *
 * Included:
 * - Static marketing routes
 * - Public profiles (`profiles` where `username IS NOT NULL` and not deactivated)
 * - Resolved challenge share pages (only resolved — pending/active have no
 *   result yet and shouldn't be indexed)
 * - Referral landing pages for the top users (these drive signups)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static marketing routes always included.
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/props`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/recap`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Best-effort dynamic sections — failure on any individual query falls
  // back to an empty array so the sitemap is still served, just smaller.
  const supabase = createAdminClient();
  const [profileEntries, challengeEntries, referralEntries] = await Promise.all([
    fetchProfileEntries(supabase),
    fetchResolvedChallengeEntries(supabase),
    fetchReferralEntries(supabase),
  ]);

  return [
    ...staticRoutes,
    ...profileEntries,
    ...challengeEntries,
    ...referralEntries,
  ];
}

// ---------------------------------------------------------------------------
// Dynamic section helpers — each is best-effort and never throws
// ---------------------------------------------------------------------------

async function fetchProfileEntries(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<MetadataRoute.Sitemap> {
  try {
    const { data, error } = await (supabase.from("profiles") as any)
      .select("username, updated_at")
      .not("username", "is", null)
      .eq("is_deactivated", false)
      .order("updated_at", { ascending: false })
      .limit(MAX_PROFILES);

    if (error) {
      logError("sitemap", "Failed to fetch profiles for sitemap", undefined, error);
      return [];
    }

    return ((data ?? []) as Array<{ username: string; updated_at: string | null }>).map(
      (row) => ({
        url: `${SITE_URL}/users/${row.username}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }),
    );
  } catch (err) {
    logError("sitemap", "Unexpected error fetching profiles for sitemap", undefined, err);
    return [];
  }
}

async function fetchResolvedChallengeEntries(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<MetadataRoute.Sitemap> {
  try {
    const { data, error } = await (supabase.from("challenges") as any)
      .select("id, resolved_at")
      .eq("status", "resolved")
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(MAX_CHALLENGES);

    if (error) {
      logError("sitemap", "Failed to fetch challenges for sitemap", undefined, error);
      return [];
    }

    return ((data ?? []) as Array<{ id: string; resolved_at: string | null }>).map(
      (row) => ({
        url: `${SITE_URL}/challenges/${row.id}/share`,
        lastModified: row.resolved_at ? new Date(row.resolved_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      }),
    );
  } catch (err) {
    logError("sitemap", "Unexpected error fetching challenges for sitemap", undefined, err);
    return [];
  }
}

async function fetchReferralEntries(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<MetadataRoute.Sitemap> {
  try {
    // Top users by total cards — these are the most active, so their
    // referral landing pages are most likely to convert.
    const { data, error } = await (supabase.from("leaderboard_entries") as any)
      .select("user_id, total_cards, profiles!inner(username, is_deactivated)")
      .gt("total_cards", 0)
      .order("total_cards", { ascending: false })
      .limit(MAX_REFERRERS);

    if (error) {
      logError("sitemap", "Failed to fetch referrers for sitemap", undefined, error);
      return [];
    }

    type Row = {
      user_id: string;
      profiles: { username: string | null; is_deactivated: boolean } | null;
    };

    return ((data ?? []) as Row[])
      .filter((row) => row.profiles?.username && !row.profiles.is_deactivated)
      .map((row) => ({
        url: `${SITE_URL}/join/${row.profiles!.username}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.4,
      }));
  } catch (err) {
    logError("sitemap", "Unexpected error fetching referrers for sitemap", undefined, err);
    return [];
  }
}
