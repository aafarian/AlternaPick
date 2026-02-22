import type { LucideIcon } from "lucide-react";
import type { BreakdownEntry } from "@/lib/recaps/compute";
import { TILE, TileHeader, MAX_TILE_ITEMS_LARGE } from "./shared";

export function BreakdownTile({
  title,
  icon,
  items,
  avgRate,
  formatKey,
}: {
  title: string;
  icon: LucideIcon;
  items: BreakdownEntry[];
  avgRate: number;
  formatKey?: (key: string) => string;
}) {
  if (items.length === 0) return null;
  const top = items.slice(0, MAX_TILE_ITEMS_LARGE);
  return (
    <div className={`${TILE} border-border bg-card`}>
      <TileHeader
        icon={icon}
        label={title}
        textColor="text-muted-foreground"
      />
      <div className="mt-2 flex flex-col gap-1.5 flex-1">
        {top.map((entry) => {
          const pct = Math.round(entry.hitRate * 100);
          const isHot = entry.hitRate >= avgRate;
          return (
            <div key={entry.key} className="flex items-center justify-between">
              <span className="text-xs text-foreground truncate">
                {formatKey ? formatKey(entry.key) : entry.key}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {entry.pickCount}
                </span>
                <span
                  className={`text-xs font-bold tabular-nums ${isHot ? "text-neon-green" : "text-bold-red"}`}
                >
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
