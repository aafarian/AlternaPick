import RankBadge from "./RankBadge";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
  variant: "desktop" | "mobile";
}

export default function LeaderboardRow({
  entry,
  isCurrentUser,
  variant,
}: LeaderboardRowProps) {
  const { rank, user, stats } = entry;
  const initials = (user.display_name ?? user.username)
    .slice(0, 2)
    .toUpperCase();

  if (variant === "mobile") {
    return (
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

          <Avatar className="h-10 w-10">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.username} />}
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {user.display_name ?? user.username}
              {isCurrentUser && (
                <span className="ml-1.5 text-xs text-primary">(you)</span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">
                {(stats.win_rate * 100).toFixed(1)}%
              </span>
              <span>
                {stats.current_streak}/{stats.best_streak} streak
              </span>
              <span>
                {stats.h2h_wins}W-{stats.h2h_losses}L
              </span>
              <span>{stats.total_cards} cards</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TableRow
      className={cn(
        "border-border",
        isCurrentUser && "bg-primary/5 border-primary/20"
      )}
    >
      <TableCell>
        <RankBadge rank={rank} />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.username} />}
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {user.display_name ?? user.username}
              {isCurrentUser && (
                <span className="ml-1.5 text-xs text-primary">(you)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
      </TableCell>

      <TableCell className="text-sm font-bold">
        {(stats.win_rate * 100).toFixed(1)}%
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {stats.total_correct_picks}
      </TableCell>

      <TableCell className="text-sm">
        <span className="font-bold">{stats.current_streak}</span>
        <span className="text-muted-foreground"> / {stats.best_streak}</span>
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {stats.h2h_wins}W - {stats.h2h_losses}L
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {stats.total_cards}
      </TableCell>
    </TableRow>
  );
}
