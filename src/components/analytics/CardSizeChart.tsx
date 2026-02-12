import type { CardSizeStats } from "@/lib/analytics/types";

interface CardSizeChartProps {
  data: CardSizeStats[];
}

export default function CardSizeChart({ data }: CardSizeChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Hit Rate by Card Size
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const maxCards = Math.max(...data.map((d) => d.cards));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Hit Rate by Card Size
      </h2>
      <div className="flex flex-col gap-3">
        {data.map((item) => {
          const pct = Math.round(item.rate * 100);
          const isHot = pct >= 60;
          const isCold = pct < 40;

          return (
            <div key={item.cardSize} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {item.cardSize}-Pick
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {pct}%{" "}
                  <span className="text-[10px]">
                    ({item.hits}/{item.total} picks across {item.cards}{" "}
                    card{item.cards !== 1 ? "s" : ""})
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
                  style={{ width: `${pct}%` }}
                />
                {/* Volume indicator: faint overlay showing card count relative to max */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground/5"
                  style={{
                    width: `${maxCards > 0 ? (item.cards / maxCards) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-neon-green/50" />
          60%+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-electric-blue/50" />
          40-59%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-bold-red/50" />
          &lt;40%
        </span>
      </div>
    </div>
  );
}
