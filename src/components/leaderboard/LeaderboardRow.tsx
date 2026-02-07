import RankBadge from "./RankBadge";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
}

export default function LeaderboardRow({
  entry,
  isCurrentUser,
}: LeaderboardRowProps) {
  const { rank, user, stats } = entry;
  const initials = (user.display_name ?? user.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Desktop row - hidden on mobile */}
      <tr
        className={`hidden border-b border-border transition-colors md:table-row ${
          isCurrentUser
            ? "bg-indigo-500/10 border-indigo-500/30"
            : "hover:bg-surface-hover"
        }`}
      >
        {/* Rank */}
        <td className="px-4 py-3">
          <RankBadge rank={rank} />
        </td>

        {/* User */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user.display_name ?? user.username}
                {isCurrentUser && (
                  <span className="ml-1.5 text-xs text-indigo-400">(you)</span>
                )}
              </p>
              <p className="truncate text-xs text-muted">@{user.username}</p>
            </div>
          </div>
        </td>

        {/* Win Rate */}
        <td className="px-4 py-3 text-sm font-medium">
          {(stats.win_rate * 100).toFixed(1)}%
        </td>

        {/* Correct Picks */}
        <td className="px-4 py-3 text-sm text-muted">
          {stats.total_correct_picks}
        </td>

        {/* Streak */}
        <td className="px-4 py-3 text-sm">
          <span className="text-foreground">{stats.current_streak}</span>
          <span className="text-muted"> / {stats.best_streak}</span>
        </td>

        {/* H2H */}
        <td className="px-4 py-3 text-sm text-muted">
          {stats.h2h_wins}W - {stats.h2h_losses}L
        </td>

        {/* Cards */}
        <td className="px-4 py-3 text-sm text-muted">{stats.total_cards}</td>
      </tr>

      {/* Mobile card - hidden on desktop */}
      <div
        className={`flex items-center gap-3 rounded-2xl border p-4 md:hidden ${
          isCurrentUser
            ? "border-indigo-500/30 bg-indigo-500/10"
            : "border-border bg-surface"
        }`}
      >
        {/* Rank */}
        <div className="shrink-0">
          <RankBadge rank={rank} />
        </div>

        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {user.display_name ?? user.username}
            {isCurrentUser && (
              <span className="ml-1.5 text-xs text-indigo-400">(you)</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="font-medium text-foreground">
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
      </div>
    </>
  );
}
