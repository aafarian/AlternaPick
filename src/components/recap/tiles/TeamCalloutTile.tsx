import { Shield } from "lucide-react";
import type { BreakdownEntry } from "@/lib/recaps/compute";
import { teamFullName } from "@/lib/constants";
import { TILE_STATIC, TileHeader, TilePill } from "./shared";

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
  const name = teamFullName(team.key);

  return (
    <div className={`${TILE_STATIC} ${tileBorder}`}>
      <TileHeader
        icon={Shield}
        label={isBest ? "Best Team" : "Worst Team"}
        textColor={textColor}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {name} {isBest ? "props were cash today" : "was a trap today"}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <TilePill
          bgColor={pillBg}
          left={name}
          right={`${Math.round(team.hitRate * 100)}% · ${team.pickCount} picks`}
          rightColor={textColor}
        />
      </div>
    </div>
  );
}
