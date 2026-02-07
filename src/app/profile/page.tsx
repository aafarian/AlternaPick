import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, LeaderboardEntry } from "@/lib/supabase/types";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileEditForm from "@/components/profile/ProfileEditForm";

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
        <span className="text-4xl">⏳</span>
        <h1 className="text-xl font-semibold">Setting up your profile...</h1>
        <p className="text-muted">
          Please refresh the page in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold">Profile</h1>
      <ProfileCard
        profile={profile as Profile}
        email={user.email ?? ""}
        stats={(stats as LeaderboardEntry | null) ?? null}
      />
      <ProfileEditForm
        displayName={(profile as Profile).display_name}
        avatarUrl={(profile as Profile).avatar_url}
      />
    </div>
  );
}
