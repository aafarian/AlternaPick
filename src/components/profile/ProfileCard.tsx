import type { Profile, LeaderboardEntry } from "@/lib/supabase/types";

interface ProfileCardProps {
  profile: Profile;
  email: string;
  stats: LeaderboardEntry | null;
}

export default function ProfileCard({ profile, email, stats }: ProfileCardProps) {
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            profile.username.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold">{profile.display_name ?? profile.username}</h2>
          <p className="text-sm text-muted">@{profile.username}</p>
          <p className="text-xs text-muted">{email}</p>
          <p className="text-xs text-muted">Member since {memberSince}</p>
        </div>
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
            <div className="text-lg font-bold">{stats.total_cards}</div>
            <div className="text-xs text-muted">Cards</div>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
            <div className="text-lg font-bold">{stats.total_correct_picks}</div>
            <div className="text-xs text-muted">Correct</div>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
            <div className="text-lg font-bold">
              {(stats.win_rate * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted">Win Rate</div>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
            <div className="text-lg font-bold text-green-400">
              {stats.current_streak}
            </div>
            <div className="text-xs text-muted">Streak</div>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
            <div className="text-lg font-bold">{stats.best_streak}</div>
            <div className="text-xs text-muted">Best</div>
          </div>
        </div>
      )}
    </div>
  );
}
