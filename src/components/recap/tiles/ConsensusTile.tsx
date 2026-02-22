import { AlertTriangle, Check } from "lucide-react";
import type { ConsensusPick } from "@/lib/recaps/compute";
import { TILE, TileHeader, MAX_TILE_ITEMS, catLabel } from "./shared";

export function ConsensusTile({
  picks,
  variant,
}: {
  picks: ConsensusPick[];
  variant: "trap" | "win";
}) {
  if (picks.length === 0) return null;
  const top = picks.slice(0, MAX_TILE_ITEMS);
  const isTrap = variant === "trap";
  const tileBorder = isTrap
    ? "border-bold-red/20 bg-bold-red/5"
    : "border-neon-green/20 bg-neon-green/5";
  const textColor = isTrap ? "text-bold-red" : "text-neon-green";
  const badgeBg = isTrap ? "bg-bold-red/15" : "bg-neon-green/15";

  return (
    <div className={`${TILE} ${tileBorder}`}>
      <TileHeader
        icon={isTrap ? AlertTriangle : Check}
        label={isTrap ? "Crowd Got Burned" : "Crowd Nailed It"}
        textColor={textColor}
      />
      <div className="mt-2 flex flex-col gap-2 flex-1">
        {top.map((c) => (
          <div key={c.propId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {c.playerName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {c.line} {catLabel(c.statCategory)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full ${badgeBg} px-2 py-0.5 text-[10px] font-bold ${textColor}`}
            >
              {Math.round(c.dominantPct * 100)}% {c.dominantSide}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
