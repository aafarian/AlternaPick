import { Users, Check, X } from "lucide-react";
import type { ConsensusPick } from "@/lib/recaps/compute";
import { TILE, TileHeader, MAX_TILE_ITEMS, catLabel } from "./shared";

export function UnanimousPropsTile({
  picks,
}: {
  picks: ConsensusPick[];
}) {
  if (picks.length === 0) return null;
  const top = picks.slice(0, MAX_TILE_ITEMS);

  return (
    <div className={`${TILE} border-electric-blue/20 bg-electric-blue/5`}>
      <TileHeader
        icon={Users}
        label="Everyone Agreed"
        textColor="text-electric-blue"
      />
      <div className="mt-2 flex flex-col gap-2 flex-1">
        {top.map((c) => (
          <div key={c.propId} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {c.playerName} {c.line} {catLabel(c.statCategory)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {c.pickCount} picks
              </p>
            </div>
            {c.wasCorrect ? (
              <Check className="h-4 w-4 shrink-0 text-neon-green" />
            ) : (
              <X className="h-4 w-4 shrink-0 text-bold-red" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
