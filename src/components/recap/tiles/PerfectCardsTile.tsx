import { Trophy } from "lucide-react";
import Link from "next/link";
import type { PerfectCardEntry } from "@/lib/recaps/compute";
import { TILE, TileHeader } from "./shared";

export function PerfectCardsTile({
  count,
  usernames,
  entries,
}: {
  count: number;
  usernames: string[];
  entries?: PerfectCardEntry[];
}) {
  if (count === 0) return null;
  return (
    <div className={`${TILE} border-amber-500/20 bg-amber-500/5`}>
      <TileHeader
        icon={Trophy}
        label={`Perfect ${count === 1 ? "Card" : "Cards"}`}
        textColor="text-amber-400"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {count} {count === 1 ? "player" : "players"} hit every single pick
      </p>
      {entries && entries.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2 flex-1">
          {entries.map((entry) => (
            <Link
              key={entry.cardId}
              href={`/users/${entry.username}`}
              className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 hover:bg-amber-500/20 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                  @{entry.username}
                </p>
              </div>
              <span className="text-xs font-bold tabular-nums text-amber-400 shrink-0">
                {entry.score}/{entry.totalPicks}
              </span>
            </Link>
          ))}
        </div>
      ) : usernames.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2 flex-1">
          {usernames.map((u) => (
            <Link
              key={u}
              href={`/users/${u}`}
              className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 hover:bg-amber-500/20 transition-colors"
            >
              <p className="text-xs font-semibold text-foreground">@{u}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Every pick was a hit
        </p>
      )}
    </div>
  );
}
