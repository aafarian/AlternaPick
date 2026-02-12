import type { TeamStats } from "@/lib/analytics/types";
import { teamTricode } from "@/lib/constants";

interface TeamHitRateProps {
  data: TeamStats[];
}

export default function TeamHitRate({ data }: TeamHitRateProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Hit Rate by Team
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Hit Rate by Team
      </h2>
      <div className="flex flex-col gap-2.5">
        {data.map((team, index) => {
          const pct = Math.round(team.rate * 100);
          const isHot = pct >= 60;
          const isCold = pct < 40;
          const code = teamTricode(team.team);

          return (
            <div key={team.team} className="flex items-center gap-3">
              {/* Rank */}
              <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">
                {index + 1}
              </span>

              {/* Team code + Bar */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {code}
                  </span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                    {pct}%{" "}
                    <span className="text-[10px]">
                      ({team.hits}/{team.total})
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
