"use client";

import RankBadge from "./RankBadge";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import { parseIconConfig } from "@/lib/icons/parse";
import UserAvatar from "@/components/icons/UserAvatar";
import { TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion";
import UserProfilePopover from "@/components/user/UserProfilePopover";


function TierRate({ rate, color }: { rate: number | null; color: string }) {
  if (rate == null) return <span className="text-muted-foreground/40">—</span>;
  return <span className={cn("tabular-nums", color)}>{rate.toFixed(0)}%</span>;
}

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
  variant: "desktop" | "mobile";
  sort: "hit_rate" | "h2h" | "flame_tokens";
}

export default function LeaderboardRow({
  entry,
  isCurrentUser,
  variant,
  sort,
}: LeaderboardRowProps) {
  const { rank, user, stats } = entry;
  const prefersReduced = useReducedMotion();
  const isFlame = sort === "flame_tokens";

  if (variant === "mobile") {
    return (
      <div
        className={cn(
          "rounded-xl transition-transform duration-200",
          !prefersReduced && "hover:-translate-y-0.5 hover:shadow-md"
        )}
      >
        <Card
          className={cn(
            isCurrentUser
              ? "border-primary/20 bg-primary/5"
              : "border-border bg-card"
          )}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="shrink-0">
              <RankBadge rank={rank} />
            </div>

            <UserProfilePopover
              userId={user.id}
              username={user.username}
              className="flex min-w-0 flex-1"
              align="start"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <UserAvatar
                  avatarUrl={user.avatar_url}
                  iconConfig={parseIconConfig(user.icon_config)}
                  userId={user.id}
                  username={user.username}
                  size={40}
                  className="shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {user.username}
                    {isCurrentUser && (
                      <span className="ml-1.5 text-xs text-primary">(you)</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className={cn(sort === "hit_rate" ? "font-bold text-foreground" : "")}>
                      {(stats.standard_hit_rate ?? stats.win_rate).toFixed(1)}%
                    </span>
                    {isFlame ? (
                      <>
                        <span className="font-bold text-orange-400">
                          {stats.fire_tokens_balance.toLocaleString()} 🔥
                        </span>
                        {stats.biggest_payout > 0 && (
                          <span className="text-emerald-500">
                            best: +{stats.biggest_payout.toLocaleString()}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>
                          {stats.current_streak}/{stats.best_streak} streak
                        </span>
                        <span className={cn(sort === "h2h" ? "font-bold text-foreground" : "")}>
                          {stats.h2h_wins}W-{stats.h2h_losses}L
                        </span>
                        <span>{stats.total_cards} cards</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </UserProfilePopover>
          </CardContent>
        </Card>
      </div>
    );
  }

  const t = stats.tier_hit_rates;

  return (
    <TableRow
      className={cn(
        "border-border",
        isCurrentUser && "bg-primary/5 border-primary/20",
        !prefersReduced && "hover:bg-muted/40"
      )}
    >
      <TableCell>
        <RankBadge rank={rank} />
      </TableCell>

      <TableCell>
        <UserProfilePopover
          userId={user.id}
          username={user.username}
          align="start"
        >
          <div className="flex items-center gap-3 text-left">
            <UserAvatar
              avatarUrl={user.avatar_url}
              iconConfig={parseIconConfig(user.icon_config)}
              userId={user.id}
              username={user.username}
              size={36}
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {user.username}
                {isCurrentUser && (
                  <span className="ml-1.5 text-xs text-primary">(you)</span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
        </UserProfilePopover>
      </TableCell>

      <TableCell className={cn("text-sm", sort === "hit_rate" ? "font-bold" : "text-muted-foreground")}>
        {(stats.standard_hit_rate ?? stats.win_rate).toFixed(1)}%
      </TableCell>

      {isFlame ? (
        <>
          <TableCell className="text-sm"><TierRate rate={t?.frosty} color="text-blue-400" /></TableCell>
          <TableCell className="text-sm"><TierRate rate={t?.chilled} color="text-sky-400" /></TableCell>
          <TableCell className="text-sm"><TierRate rate={t?.heated} color="text-yellow-400" /></TableCell>
          <TableCell className="text-sm"><TierRate rate={t?.scorched} color="text-orange-400" /></TableCell>
          <TableCell className="text-sm"><TierRate rate={t?.volcanic} color="text-red-400" /></TableCell>

          <TableCell className="text-sm font-bold tabular-nums text-orange-400">
            {stats.fire_tokens_balance.toLocaleString()}
          </TableCell>

          <TableCell className="text-sm tabular-nums text-emerald-500">
            {stats.biggest_payout > 0 ? `+${stats.biggest_payout.toLocaleString()}` : "—"}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="text-sm text-muted-foreground">
            {stats.total_correct_picks}
          </TableCell>

          <TableCell className="text-sm">
            <span className="font-bold">{stats.current_streak}</span>
            <span className="text-muted-foreground"> / {stats.best_streak}</span>
          </TableCell>

          <TableCell className={cn("text-sm", sort === "h2h" ? "font-bold" : "text-muted-foreground")}>
            {stats.h2h_wins}W - {stats.h2h_losses}L
          </TableCell>

          <TableCell className="text-sm tabular-nums text-orange-400">
            {stats.fire_tokens_balance.toLocaleString()}
          </TableCell>

          <TableCell className="text-sm text-muted-foreground">
            {stats.total_cards}
          </TableCell>
        </>
      )}
    </TableRow>
  );
}
