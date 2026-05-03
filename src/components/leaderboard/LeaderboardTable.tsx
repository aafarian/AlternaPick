"use client";

import LeaderboardRow from "./LeaderboardRow";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import { AnimatedList } from "@/components/motion";
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
  sort: "hit_rate" | "h2h" | "flame_tokens";
}

export default function LeaderboardTable({
  entries,
  currentUserId,
  sort,
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
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hit Rate</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tiers</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Correct</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Streak</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">H2H</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">🔥 Flame</TableHead>
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
                sort={sort}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards — staggered animation */}
      <AnimatedList className="flex flex-col gap-2 md:hidden" animationType="slideUp">
        {entries.map((entry) => (
          <LeaderboardRow
            key={entry.user.id}
            entry={entry}
            isCurrentUser={entry.user.id === currentUserId}
            variant="mobile"
            sort={sort}
          />
        ))}
      </AnimatedList>
    </>
  );
}
