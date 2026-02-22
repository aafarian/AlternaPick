import { TrendingUp } from "lucide-react";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { MostPickedProp } from "@/lib/recaps/compute";
import { TILE, TileHeader, MAX_TILE_ITEMS, catLabel } from "./shared";

export function MostPickedPropsTile({
  props,
}: {
  props: MostPickedProp[];
}) {
  if (props.length === 0) return null;
  const top = props.slice(0, MAX_TILE_ITEMS);
  return (
    <div className={`${TILE} border-electric-blue/20 bg-electric-blue/5`}>
      <TileHeader
        icon={TrendingUp}
        label="Top Props"
        textColor="text-electric-blue"
      />
      <div className="mt-2 flex flex-col gap-2 flex-1">
        {top.map((p) => {
          const total =
            p.selectionBreakdown.over + p.selectionBreakdown.under;
          const overPct =
            total > 0
              ? Math.round((p.selectionBreakdown.over / total) * 100)
              : 50;
          return (
            <div key={p.propId} className="flex items-center gap-2">
              <PlayerAvatar
                playerId={p.playerId}
                playerName={p.playerName}
                sport={p.sport}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {p.playerName} {p.line} {catLabel(p.statCategory)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {overPct}% over · {p.pickCount} picks
                </p>
              </div>
              <span className="text-xs font-bold tabular-nums text-electric-blue shrink-0">
                {Math.round(p.hitRate * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
