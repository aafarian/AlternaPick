import type { Profile, LeaderboardEntry } from "@/lib/supabase/types";
import { parseIconConfig } from "@/lib/icons/parse";
import { Card, CardContent } from "@/components/ui/card";
import UserAvatar from "@/components/icons/UserAvatar";
import { ProfileStatsGrid, ProfileStatCard } from "@/components/profile/ProfileStatsGrid";

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
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            avatarUrl={profile.avatar_url}
            iconConfig={parseIconConfig(profile.icon_config)}
            userId={profile.id}
            username={profile.username}
            size={64}
          />
          <div>
            <h2 className="text-xl font-bold">{profile.username}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground">Member since {memberSince}</p>
          </div>
        </div>

        {stats && (
          <ProfileStatsGrid>
            <ProfileStatCard>
              <div className="text-lg font-bold tabular-nums">{stats.total_cards}</div>
              <div className="text-xs text-muted-foreground">Cards</div>
            </ProfileStatCard>
            <ProfileStatCard>
              <div className="text-lg font-bold tabular-nums">{stats.total_correct_picks}</div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </ProfileStatCard>
            <ProfileStatCard>
              <div className="text-lg font-bold tabular-nums">
                {stats.win_rate.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Hit Rate</div>
            </ProfileStatCard>
            <ProfileStatCard>
              <div className="text-lg font-bold tabular-nums text-neon-green">
                {stats.current_streak}
              </div>
              <div className="text-xs text-muted-foreground">Streak</div>
            </ProfileStatCard>
            <ProfileStatCard>
              <div className="text-lg font-bold tabular-nums">{stats.best_streak}</div>
              <div className="text-xs text-muted-foreground">Best</div>
            </ProfileStatCard>
          </ProfileStatsGrid>
        )}
      </CardContent>
    </Card>
  );
}
