import LeaderboardRow from "./LeaderboardRow";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithProfile[];
  currentUserId: string | null;
}

export default function LeaderboardTable({
  entries,
  currentUserId,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop table - hidden on mobile */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Win Rate</th>
              <th className="px-4 py-3 font-medium">Correct</th>
              <th className="px-4 py-3 font-medium">Streak</th>
              <th className="px-4 py-3 font-medium">H2H</th>
              <th className="px-4 py-3 font-medium">Cards</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.user.id}
                entry={entry}
                isCurrentUser={entry.user.id === currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards - hidden on desktop */}
      <div className="flex flex-col gap-2 md:hidden">
        {entries.map((entry) => (
          <LeaderboardRow
            key={entry.user.id}
            entry={entry}
            isCurrentUser={entry.user.id === currentUserId}
          />
        ))}
      </div>
    </>
  );
}
