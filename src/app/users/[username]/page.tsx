import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/helpers";
import type {
  Profile,
  LeaderboardEntry,
  Achievement,
  UserAchievement,
} from "@/lib/supabase/types";
import { parseIconConfig } from "@/lib/icons/parse";
import BadgeGrid from "@/components/profile/BadgeGrid";
import { AnimatedUserProfile } from "./AnimatedUserProfile";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { logError } from "@/lib/logger";

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: UserProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  // Default fallback so a missing/banned user doesn't break the metadata fetch.
  const fallback = buildPageMetadata({
    title: `@${username}`,
    description: `${username}'s player prop predictions on AlternaPick.`,
    path: `/users/${username}`,
  });

  try {
    const admin = createAdminClient();
    const { data } = await (admin.from("profiles") as any)
      .select("username, display_name, is_deactivated")
      .ilike("username", username)
      .maybeSingle();

    const profile = data as
      | { username: string; display_name: string | null; is_deactivated: boolean }
      | null;
    if (!profile || profile.is_deactivated) return fallback;

    const name = profile.display_name?.trim() || profile.username;
    return buildPageMetadata({
      title: `@${profile.username}`,
      description: `${name}'s player prop predictions on AlternaPick — see their stats, picks, and achievements.`,
      path: `/users/${profile.username}`,
    });
  } catch (err) {
    // Don't include the username in the endpoint — CLAUDE.md rule #11
    // bans usernames in log fields shipped to external logging.
    logError(
      "user-profile-metadata",
      "Failed to build user profile metadata",
      "/users/[username]",
      err,
    );
    return fallback;
  }
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Look up profile by username
  const { data: profileData } = await (supabase.from("profiles") as any)
    .select("*")
    .ilike("username", username)
    .maybeSingle();

  if (!profileData) {
    notFound();
  }

  const profile = profileData as Profile;
  const currentUser = await getCurrentUser(supabase);
  const isOwnProfile = currentUser?.id === profile.id;

  // Redirect to own profile page if viewing self
  if (isOwnProfile) {
    const { redirect } = await import("next/navigation");
    redirect("/profile");
  }

  // Fetch stats, achievements, and friendship status in parallel
  const [
    { data: statsData },
    { data: achievementsData },
    { data: userAchievementsData },
    friendshipResult,
  ] = await Promise.all([
    (supabase.from("leaderboard_entries") as any)
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle(),
    (supabase.from("achievements") as any).select("*"),
    (supabase.from("user_achievements") as any)
      .select("*")
      .eq("user_id", profile.id),
    currentUser
      ? (supabase.from("friendships") as any)
          .select("id, status")
          .or(
            `and(requester_id.eq.${currentUser.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${currentUser.id})`
          )
          .limit(1)
      : Promise.resolve({ data: null }),
  ]);

  const stats = statsData as LeaderboardEntry | null;
  const achievements = (achievementsData ?? []) as Achievement[];
  const userAchievements = (userAchievementsData ?? []) as UserAchievement[];
  const friendship = (friendshipResult.data as { id: string; status: string }[] | null)?.[0] ?? null;
  const isFriend = friendship?.status === "accepted";

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const initial = profile.username.charAt(0).toUpperCase();

  // Build serializable stat items for the client component
  const statItems = stats
    ? [
        { label: "Cards", value: String(stats.total_cards) },
        { label: "Correct", value: String(stats.total_correct_picks) },
        { label: "Hit Rate", value: `${stats.win_rate.toFixed(0)}%` },
        { label: "Streak", value: String(stats.current_streak), highlight: true },
        { label: "H2H", value: `${stats.h2h_wins}W-${stats.h2h_losses}L` },
      ]
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
      {/* Profile header */}
      <AnimatedUserProfile
        profile={{
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          icon_config: parseIconConfig(profile.icon_config),
        }}
        memberSince={memberSince}
        initial={initial}
        stats={statItems}
        currentUser={!!currentUser}
        isFriend={isFriend}
        hasPendingFriendship={!!friendship}
      />

      {/* Badges */}
      <BadgeGrid achievements={achievements} unlocked={userAchievements} />
    </div>
  );
}
