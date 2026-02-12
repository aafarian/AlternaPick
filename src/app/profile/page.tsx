import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type {
  Profile,
  LeaderboardEntry,
  Achievement,
  UserAchievement,
} from "@/lib/supabase/types";
import { getReferralInfo, getReferralStats } from "@/lib/referrals/queries";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileChecklist from "@/components/onboarding/ProfileChecklist";
import type { ChecklistItem } from "@/components/onboarding/ProfileChecklist";
import BadgeGrid from "@/components/profile/BadgeGrid";
import ReferralSection from "@/components/profile/ReferralSection";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [
    { data: profile },
    { data: stats },
    friendshipResult,
    { data: achievementsData },
    { data: userAchievementsData },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    (supabase.from("friendships") as any)
      .select("id", { count: "exact", head: true })
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
    (supabase.from("achievements") as any).select("*"),
    (supabase.from("user_achievements") as any)
      .select("*")
      .eq("user_id", user.id),
  ]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <span className="text-4xl">&#9203;</span>
        <h1 className="text-xl font-semibold">Setting up your profile...</h1>
        <p className="text-muted-foreground">
          Please refresh the page in a moment.
        </p>
      </div>
    );
  }

  const friendCount = (friendshipResult.count ?? 0) as number;
  const achievements = (achievementsData ?? []) as Achievement[];
  const userAchievements = (userAchievementsData ?? []) as UserAchievement[];

  // Fetch referral data (non-blocking — graceful fallback on error)
  let referralInfo = { referralLink: "", totalReferred: 0, rewardsEarned: 0 };
  let referredUsers: { username: string; display_name: string | null; created_at: string }[] = [];
  try {
    const [info, stats_referral] = await Promise.all([
      getReferralInfo(supabase, user.id),
      getReferralStats(supabase, user.id),
    ]);
    referralInfo = info;
    referredUsers = stats_referral.referredUsers;
  } catch {
    // Silently degrade — referral section will still render with defaults
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  const referralBaseUrl = baseUrl.startsWith("http")
    ? baseUrl
    : `https://${baseUrl}`;

  const checklistItems: ChecklistItem[] = [
    {
      label: "Set display name",
      completed: !!(profile as Profile).display_name?.trim(),
      href: "/settings",
    },
    {
      label: "Set avatar",
      completed: !!(profile as Profile).avatar_url,
      href: "/settings",
    },
    {
      label: "Add a friend",
      completed: friendCount > 0,
      href: "/friends",
    },
  ];

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Edit Profile
          </Link>
        </Button>
      </div>
      <ProfileCard
        profile={profile as Profile}
        email={user.email ?? ""}
        stats={(stats as LeaderboardEntry | null) ?? null}
      />
      <ProfileChecklist items={checklistItems} />
      <BadgeGrid achievements={achievements} unlocked={userAchievements} />
      <ReferralSection
        referralInfo={referralInfo}
        referredUsers={referredUsers}
        baseUrl={referralBaseUrl}
      />
    </div>
  );
}
