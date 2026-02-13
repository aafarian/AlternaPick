import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import type {
  Profile,
  LeaderboardEntry,
  Achievement,
  UserAchievement,
} from "@/lib/supabase/types";
import BadgeGrid from "@/components/profile/BadgeGrid";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Swords, UserPlus } from "lucide-react";

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Look up profile by username
  const { data: profileData } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("username", username)
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
  const initial = (profile.display_name ?? profile.username).charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
      {/* Profile header */}
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile.avatar_url && (
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  width={64}
                  height={64}
                  className="aspect-square size-full object-cover"
                />
              )}
              <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">
                {profile.display_name ?? profile.username}
              </h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <p className="text-xs text-muted-foreground">Member since {memberSince}</p>
            </div>

            {/* Action buttons */}
            {currentUser && (
              <div className="flex shrink-0 gap-2">
                {isFriend ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/challenges?opponent=${profile.username}`} className="gap-1.5">
                      <Swords className="h-4 w-4" />
                      Challenge
                    </Link>
                  </Button>
                ) : !friendship ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/friends?add=${profile.username}`} className="gap-1.5">
                      <UserPlus className="h-4 w-4" />
                      Add Friend
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Pending
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">{stats.total_cards}</div>
                <div className="text-xs text-muted-foreground">Cards</div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">{stats.total_correct_picks}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {stats.win_rate.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Hit Rate</div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
                <div className="text-lg font-bold tabular-nums text-neon-green">
                  {stats.current_streak}
                </div>
                <div className="text-xs text-muted-foreground">Streak</div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {stats.h2h_wins}W-{stats.h2h_losses}L
                </div>
                <div className="text-xs text-muted-foreground">H2H</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges */}
      <BadgeGrid achievements={achievements} unlocked={userAchievements} />
    </div>
  );
}
