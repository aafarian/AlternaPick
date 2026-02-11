import type { PlayerStats } from "@/lib/analytics/types";

interface PlayerHitRateProps {
  data: PlayerStats[];
}

export default function PlayerHitRate({ data }: PlayerHitRateProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Top 10 Players
      </h2>
      <div className="flex flex-col gap-2.5">
        {data.map((player, index) => {
          const pct = Math.round(player.rate * 100);
          const isHot = pct >= 60;
          const isCold = pct < 40;

          return (
            <div key={player.player_name} className="flex items-center gap-3">
              {/* Rank */}
              <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">
                {index + 1}
              </span>

              {/* Name + Bar */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-foreground">
                    {player.player_name}
                  </span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                    {pct}%{" "}
                    <span className="text-[10px]">
                      ({player.hits}/{player.total})
                    </span>
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                      isHot
                        ? "bg-neon-green/50"
                        : isCold
                          ? "bg-bold-red/50"
                          : "bg-electric-blue/50"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
