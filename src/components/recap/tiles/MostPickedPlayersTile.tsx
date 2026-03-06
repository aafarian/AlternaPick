import { TrendingUp } from "lucide-react";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { MostPickedPlayer } from "@/lib/recaps/compute";
import { TILE, TileHeader, type OnPlayerClick } from "./shared";

const MAX_PLAYERS = 4;

export function MostPickedPlayersTile({
  players,
  onPlayerClick,
}: {
  players: MostPickedPlayer[];
  onPlayerClick?: OnPlayerClick;
}) {
  if (players.length === 0) return null;
  const top = players.slice(0, MAX_PLAYERS);
  return (
    <div className={`${TILE} border-electric-blue/20 bg-electric-blue/5`}>
      <TileHeader
        icon={TrendingUp}
        label="Most Picked"
        textColor="text-electric-blue"
      />
      <div className="mt-2 flex flex-col gap-2 flex-1">
        {top.map((p) => (
          <button
            key={p.playerName}
            type="button"
            className="flex items-center gap-2 w-full text-left rounded-md px-1 -mx-1 transition-colors hover:bg-foreground/5 cursor-pointer"
            onClick={() => onPlayerClick?.({ playerName: p.playerName, sport: p.sport })}
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
              {p.team && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {p.team}
                </p>
              )}
            </div>
            <span className="text-xs font-bold tabular-nums text-electric-blue shrink-0">
              {p.pickCount}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
