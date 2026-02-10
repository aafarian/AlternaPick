import type { Profile, LeaderboardEntry } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  const initial = (profile.display_name ?? profile.username).charAt(0).toUpperCase();

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
            )}
            <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{profile.display_name ?? profile.username}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground">Member since {memberSince}</p>
          </div>
        </div>

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
                {(stats.win_rate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
              <div className="text-lg font-bold tabular-nums text-neon-green">
                {stats.current_streak}
              </div>
              <div className="text-xs text-muted-foreground">Streak</div>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
              <div className="text-lg font-bold tabular-nums">{stats.best_streak}</div>
              <div className="text-xs text-muted-foreground">Best</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
