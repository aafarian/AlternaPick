import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile, LeaderboardEntry } from "@/lib/supabase/types";
import ProfileCard from "@/components/profile/ProfileCard";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: stats } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .eq("user_id", user.id)
    .single();

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
    </div>
  );
}
