import LeaderboardRow from "./LeaderboardRow";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rank</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Player</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Win Rate</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Correct</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Streak</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">H2H</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cards</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.user.id}
                entry={entry}
                isCurrentUser={entry.user.id === currentUserId}
                variant="desktop"
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {entries.map((entry) => (
          <LeaderboardRow
            key={entry.user.id}
            entry={entry}
            isCurrentUser={entry.user.id === currentUserId}
            variant="mobile"
          />
        ))}
      </div>
    </>
  );
}
