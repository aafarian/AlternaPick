"use client";

import LeaderboardRow from "./LeaderboardRow";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import { AnimatedList } from "@/components/motion";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
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

const TH = "text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

export default function LeaderboardTable({
  entries,
  currentUserId,
  sort,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return null;
  }

  const isFlame = sort === "flame_tokens";

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className={TH}>Rank</TableHead>
              <TableHead className={TH}>Player</TableHead>
              <TableHead className={TH}>Hit Rate</TableHead>
              {isFlame ? (
                <>
                  <TableHead className={TH}>Heated</TableHead>
                  <TableHead className={TH}>Scorched</TableHead>
                  <TableHead className={TH}>Volcanic</TableHead>
                  <TableHead className={TH}><span className="inline-flex items-center gap-1"><FlameTokenIcon className="h-3 w-3" /> Flame</span></TableHead>
                  <TableHead className={TH}>Best Payout</TableHead>
                </>
              ) : (
                <>
                  <TableHead className={TH}>Correct</TableHead>
                  <TableHead className={TH}>Streak</TableHead>
                  <TableHead className={TH}>H2H</TableHead>
                  <TableHead className={TH}><span className="inline-flex items-center gap-1"><FlameTokenIcon className="h-3 w-3" /> Flame</span></TableHead>
                  <TableHead className={TH}>Cards</TableHead>
                </>
              )}
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

      {/* Mobile — podium top 3 + ranked list */}
      <div className="flex flex-col gap-3 md:hidden">
        {/* Podium */}
        {entries.length >= 3 && (
          <div className="grid grid-cols-3 gap-2">
            {entries.slice(0, 3).map((entry) => (
              <LeaderboardRow
                key={entry.user.id}
                entry={entry}
                isCurrentUser={entry.user.id === currentUserId}
                variant="mobile"
                sort={sort}
              />
            ))}
          </div>
        )}
        {/* Ranked list */}
        <AnimatedList className="flex flex-col" animationType="slideUp">
          {entries.slice(entries.length >= 3 ? 3 : 0).map((entry) => (
            <LeaderboardRow
              key={entry.user.id}
              entry={entry}
              isCurrentUser={entry.user.id === currentUserId}
              variant="mobile"
              sort={sort}
            />
          ))}
        </AnimatedList>
      </div>
    </>
  );
}
