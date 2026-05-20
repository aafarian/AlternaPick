"use client";

import RankBadge from "./RankBadge";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import { parseIconConfig } from "@/lib/icons/parse";
import UserAvatar from "@/components/icons/UserAvatar";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import { TableCell, TableRow } from "@/components/ui/table";
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
    const primaryStat = isFlame
      ? stats.fire_tokens_balance.toLocaleString()
      : sort === "h2h"
        ? `${stats.h2h_wins}W-${stats.h2h_losses}L`
        : `${(stats.standard_hit_rate ?? stats.win_rate).toFixed(1)}%`;

    const primaryColor = isFlame
      ? "text-orange-400"
      : sort === "h2h"
        ? "text-foreground"
        : (stats.standard_hit_rate ?? stats.win_rate) >= 60
          ? "text-neon-green"
          : (stats.standard_hit_rate ?? stats.win_rate) >= 40
            ? "text-electric-blue"
            : "text-bold-red";

    // Podium card for top 3
    if (rank <= 3) {
      const medalColors = ["text-amber-400", "text-gray-400", "text-amber-600"];
      return (
        <div className={cn(
          "flex flex-col items-center rounded-2xl border bg-white/[0.02] px-2 pb-3 pt-2",
          isCurrentUser ? "border-primary/30" : "border-white/[0.06]",
        )}>
          <span className={cn("text-sm font-black", medalColors[rank - 1])}>
            {rank}
          </span>
          <UserProfilePopover userId={user.id} username={user.username} align="center">
            <UserAvatar
              avatarUrl={user.avatar_url}
              iconConfig={parseIconConfig(user.icon_config)}
              userId={user.id}
              username={user.username}
              size={48}
              className="my-1"
            />
          </UserProfilePopover>
          <p className="max-w-full truncate text-center text-[11px] font-bold">
            {user.username}
          </p>
          <p className={cn("text-lg font-black tabular-nums leading-tight", primaryColor)}>
            {primaryStat}
          </p>
          {isFlame && <FlameTokenIcon className="mt-0.5 h-3 w-3 text-orange-400" />}
          {isFlame && (
            <p className={cn("mt-0.5 text-[9px] tabular-nums", stats.biggest_payout > 0 ? "text-emerald-500" : "text-muted-foreground/30")}>
              {stats.biggest_payout > 0 ? `best +${stats.biggest_payout.toLocaleString()}` : "no payout yet"}
            </p>
          )}
        </div>
      );
    }

    // Clean row for rank 4+
    return (
      <div className={cn(
        "flex items-center gap-2.5 border-t border-white/5 py-2",
        isCurrentUser && "bg-primary/5 -mx-3 px-3 rounded",
      )}>
        <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground/50">
          {rank}
        </span>
        <UserProfilePopover userId={user.id} username={user.username} align="start">
          <UserAvatar
            avatarUrl={user.avatar_url}
            iconConfig={parseIconConfig(user.icon_config)}
            userId={user.id}
            username={user.username}
            size={32}
            className="shrink-0"
          />
        </UserProfilePopover>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {user.username}
          {isCurrentUser && <span className="ml-1 text-primary">(you)</span>}
        </span>
        <div className="flex shrink-0 flex-col items-end">
          <span className={cn("flex items-center gap-1 text-sm font-black tabular-nums", primaryColor)}>
            {isFlame && <FlameTokenIcon className="h-3 w-3 text-orange-400" />}
            {primaryStat}
          </span>
          {isFlame && (
            <span className={cn("text-[9px] tabular-nums", stats.biggest_payout > 0 ? "text-emerald-500" : "text-muted-foreground/30")}>
              {stats.biggest_payout > 0 ? `best +${stats.biggest_payout.toLocaleString()}` : "-"}
            </span>
          )}
        </div>
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
