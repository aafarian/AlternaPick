import type { ScoreDistributionEntry } from "@/lib/analytics/types";

interface ScoreDistributionProps {
  data: ScoreDistributionEntry[];
}

/**
 * For each card size that has data, show a row of score cells.
 * Color intensity increases with score (darker = better score).
 * E.g. "4-pick cards: 0/4(2) 1/4(3) 2/4(8) 3/4(12) 4/4(5)"
 */
export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Score Distribution
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  // Group entries by card size
  const sizeGroups = new Map<number, ScoreDistributionEntry[]>();
  for (const entry of data) {
    const group = sizeGroups.get(entry.cardSize) ?? [];
    group.push(entry);
    sizeGroups.set(entry.cardSize, group);
  }

  // Sort card sizes ascending
  const sortedSizes = [...sizeGroups.keys()].sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Score Distribution
      </h2>
      <div className="flex flex-col gap-4">
        {sortedSizes.map((cardSize) => {
          const entries = sizeGroups.get(cardSize)!;
          const totalCards = entries.reduce((s, e) => s + e.count, 0);

          // Build full score range 0..cardSize, filling in zeros for missing scores
          const scoreMap = new Map<number, number>();
          for (const e of entries) {
            scoreMap.set(e.score, e.count);
          }

          const scores: { score: number; count: number; pct: number }[] = [];
          for (let s = 0; s <= cardSize; s++) {
            const count = scoreMap.get(s) ?? 0;
            scores.push({
              score: s,
              count,
              pct: totalCards > 0 ? Math.round((count / totalCards) * 100) : 0,
            });
          }

          return (
            <div key={cardSize}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {cardSize}-Pick Cards
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {totalCards} card{totalCards !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Score cells row */}
              <div className="flex gap-1">
                {scores.map(({ score, count, pct }) => {
                  // Color intensity based on how good the score is
                  const ratio =
                    cardSize > 0 ? score / cardSize : 0;
                  const bgClass = getScoreColor(ratio);

                  return (
                    <div
                      key={score}
                      className={`flex flex-1 flex-col items-center rounded-md border border-border/50 py-1.5 ${bgClass}`}
                    >
                      <span className="text-[10px] font-bold tabular-nums text-foreground">
                        {score}/{cardSize}
                      </span>
                      <span className="text-[9px] tabular-nums text-muted-foreground">
                        {count}x
                      </span>
                      {totalCards > 1 && (
                        <span className="text-[9px] tabular-nums text-muted-foreground">
                          {pct}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-neon-green/30" />
          Perfect
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-electric-blue/20" />
          Good
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded bg-bold-red/15" />
          Low
        </span>
      </div>
    </div>
  );
}

/** Get background color class based on score ratio (0-1). */
function getScoreColor(ratio: number): string {
  if (ratio >= 1) return "bg-neon-green/30";
  if (ratio >= 0.75) return "bg-neon-green/15";
  if (ratio >= 0.5) return "bg-electric-blue/20";
  if (ratio >= 0.25) return "bg-amber-500/10";
  return "bg-bold-red/15";
}
