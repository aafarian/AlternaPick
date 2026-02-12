import type { GameModeStats as GameModeStatsType } from "@/lib/analytics/types";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";

interface GameModeStatsProps {
  data: GameModeStatsType[];
}

export default function GameModeStats({ data }: GameModeStatsProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Win Rate by Game Mode
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Win Rate by Game Mode
      </h2>
      <div className="flex flex-col gap-3">
        {data.map((item) => {
          const winPct = Math.round(item.winRate * 100);
          const isHot = winPct >= 60;
          const isCold = winPct < 40;
          const modeDef = GAME_MODES[item.mode as GameMode];
          const icon = modeDef?.icon ?? "";
          const name = modeDef?.displayName ?? item.mode;

          return (
            <div key={item.mode} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <span className="text-sm">{icon}</span>
                  {name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {winPct}% win{" "}
                  <span className="text-[10px]">
                    ({item.wins}/{item.cards} cards, avg {item.avgScore})
                  </span>
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                    isHot
                      ? "bg-neon-green/50"
                      : isCold
                        ? "bg-bold-red/50"
                        : "bg-electric-blue/50"
                  }`}
                  style={{ width: `${winPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Win = 66%+ picks correct on a card
      </p>
    </div>
  );
}
