import { AlertTriangle, Check } from "lucide-react";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { TrapOrLockProp } from "@/lib/recaps/compute";
import { TILE, TileHeader, MAX_TILE_ITEMS, catLabel, type OnPropClick } from "./shared";

export function TrapLockTile({
  items,
  variant,
  onPropClick,
}: {
  items: TrapOrLockProp[];
  variant: "trap" | "lock";
  onPropClick?: OnPropClick;
}) {
  if (items.length === 0) return null;
  const top = items.slice(0, MAX_TILE_ITEMS);
  const isTrap = variant === "trap";
  const tileBorder = isTrap
    ? "border-bold-red/20 bg-bold-red/5"
    : "border-neon-green/20 bg-neon-green/5";
  const textColor = isTrap ? "text-bold-red" : "text-neon-green";

  return (
    <div className={`${TILE} ${tileBorder}`}>
      <TileHeader
        icon={isTrap ? AlertTriangle : Check}
        label={isTrap ? "Traps" : "Locks"}
        textColor={textColor}
      />
      <div className="mt-2 flex flex-col gap-2">
        {top.map((p) => (
          <button
            key={p.propId}
            type="button"
            className="flex items-center gap-2 w-full text-left rounded-md px-1 -mx-1 transition-colors hover:bg-foreground/5 cursor-pointer"
            onClick={() => onPropClick?.({
              propId: p.propId,
              playerName: p.playerName,
              statCategory: p.statCategory,
              line: p.line,
            })}
          >
            <PlayerAvatar
              playerId={p.playerId}
              playerName={p.playerName}
              sport={p.sport}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {p.playerName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {p.line} {catLabel(p.statCategory)}
              </p>
            </div>
            <span
              className={`text-xs font-bold tabular-nums ${textColor} shrink-0`}
            >
              {Math.round(p.hitRate * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
