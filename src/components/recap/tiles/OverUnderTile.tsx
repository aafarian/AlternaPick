import { TrendingUp } from "lucide-react";
import { TILE_STATIC, TileHeader, TilePill } from "./shared";

export function OverUnderTile({
  overCount,
  underCount,
}: {
  overCount: number;
  underCount: number;
}) {
  const total = overCount + underCount;
  if (total === 0) return null;
  const overPct = Math.round((overCount / total) * 100);
  const dominant = overPct >= 50 ? "over" : "under";
  const pct = dominant === "over" ? overPct : 100 - overPct;

  return (
    <div className={`${TILE_STATIC} border-amber-500/20 bg-amber-500/5`}>
      <TileHeader
        icon={TrendingUp}
        label="Over/Under Split"
        textColor="text-amber-400"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {pct >= 55
          ? `${dominant === "over" ? "Overs" : "Unders"} were popular today`
          : "Fairly even split today"}
      </p>
      <div className="mt-2 flex flex-col gap-2 flex-1">
        <TilePill
          bgColor="bg-amber-500/10"
          left={`${pct}% ${dominant.toUpperCase()}`}
          right={`${total} picks`}
          rightColor="text-amber-400"
        />
      </div>
    </div>
  );
}
