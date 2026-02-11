import type { DirectionStats } from "@/lib/analytics/types";

interface DirectionSplitProps {
  data: DirectionStats;
}

export default function DirectionSplit({ data }: DirectionSplitProps) {
  const overPct = Math.round(data.over.rate * 100);
  const underPct = Math.round(data.under.rate * 100);
  const totalPicks = data.over.total + data.under.total;

  if (totalPicks === 0) return null;

  // Visual split: proportion of total picks that are over vs under
  const overShare =
    totalPicks > 0 ? Math.round((data.over.total / totalPicks) * 100) : 50;
  const underShare = 100 - overShare;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Over vs Under
      </h2>

      {/* Hit rate comparison */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center rounded-lg border border-neon-green/20 bg-neon-green/5 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Over
          </span>
          <span className="mt-1 text-2xl font-black tabular-nums text-neon-green">
            {overPct}%
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {data.over.hits}/{data.over.total} picks
          </span>
        </div>
        <div className="flex flex-col items-center rounded-lg border border-electric-blue/20 bg-electric-blue/5 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Under
          </span>
          <span className="mt-1 text-2xl font-black tabular-nums text-electric-blue">
            {underPct}%
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {data.under.hits}/{data.under.total} picks
          </span>
        </div>
      </div>

      {/* Volume split bar */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Pick Volume Split
        </p>
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          <div
            className="flex items-center justify-center bg-neon-green/30 text-[9px] font-bold text-neon-green transition-all"
            style={{ width: `${overShare}%` }}
          >
            {overShare > 15 && `${overShare}%`}
          </div>
          <div
            className="flex items-center justify-center bg-electric-blue/30 text-[9px] font-bold text-electric-blue transition-all"
            style={{ width: `${underShare}%` }}
          >
            {underShare > 15 && `${underShare}%`}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Over ({data.over.total})</span>
          <span>Under ({data.under.total})</span>
        </div>
      </div>
    </div>
  );
}
