import { BarChart3 } from "lucide-react";
import type { BreakdownEntry } from "@/lib/recaps/compute";
import { TILE_STATIC, TileHeader, TilePill, catLabel } from "./shared";

export function MostPopularStatTile({
  breakdown,
  platformHitRate,
}: {
  breakdown: BreakdownEntry[];
  platformHitRate: number;
}) {
  if (breakdown.length === 0) return null;
  const top = breakdown[0]; // already sorted by pickCount desc
  if (top.pickCount < 3) return null;

  const aboveAvg = top.hitRate >= platformHitRate;
  const tileBorder = aboveAvg
    ? "border-neon-green/20 bg-neon-green/5"
    : "border-amber-500/20 bg-amber-500/5";
  const textColor = aboveAvg ? "text-neon-green" : "text-amber-400";
  const pillBg = aboveAvg ? "bg-neon-green/10" : "bg-amber-500/10";

  return (
    <div className={`${TILE_STATIC} ${tileBorder}`}>
      <TileHeader
        icon={BarChart3}
        label="Most Picked Category"
        textColor={textColor}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {catLabel(top.key)} was the most popular stat
      </p>
      <div className="mt-2 flex flex-col gap-2 flex-1">
        <TilePill
          bgColor={pillBg}
          left={`${top.pickCount} ${catLabel(top.key).toLowerCase()} picks`}
          right={`${Math.round(top.hitRate * 100)}%`}
          rightColor={textColor}
        />
      </div>
    </div>
  );
}
