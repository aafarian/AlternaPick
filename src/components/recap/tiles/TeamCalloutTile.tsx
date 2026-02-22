import { Shield } from "lucide-react";
import type { BreakdownEntry } from "@/lib/recaps/compute";
import { TILE, TileHeader, TilePill } from "./shared";

export function TeamCalloutTile({
  team,
  variant,
}: {
  team: BreakdownEntry;
  variant: "best" | "worst";
}) {
  const isBest = variant === "best";
  const tileBorder = isBest
    ? "border-neon-green/20 bg-neon-green/5"
    : "border-bold-red/20 bg-bold-red/5";
  const textColor = isBest ? "text-neon-green" : "text-bold-red";
  const pillBg = isBest ? "bg-neon-green/10" : "bg-bold-red/10";

  return (
    <div className={`${TILE} ${tileBorder}`}>
      <TileHeader
        icon={Shield}
        label={isBest ? "Best Team" : "Worst Team"}
        textColor={textColor}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {team.key} {isBest ? "props were cash today" : "was a trap today"}
      </p>
      <div className="mt-2 flex flex-col gap-2 flex-1">
        <TilePill
          bgColor={pillBg}
          left={team.key}
          right={`${Math.round(team.hitRate * 100)}% · ${team.pickCount} picks`}
          rightColor={textColor}
        />
      </div>
    </div>
  );
}
