"use client";

import { teamTricode, teamLogoUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import CountdownBadge from "./CountdownBadge";

interface GameInfo {
  id: string;
  away_team: string;
  home_team: string;
  commence_time: string;
}

interface GameSelectorProps {
  games: GameInfo[];
  activeId: string | null;
  onSelect: (gameId: string) => void;
}

function TeamLogo({ team, size = 20 }: { team: string; size?: number }) {
  const url = teamLogoUrl(team);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={teamTricode(team)}
      width={size}
      height={size}
      className="shrink-0 object-contain"
    />
  );
}

export default function GameSelector({ games, activeId, onSelect }: GameSelectorProps) {
  if (games.length === 0) return null;

  return (
    <div className="flex w-full gap-2 overflow-x-auto scrollbar-none">
      {games.map((game) => (
        <button
          key={game.id}
          onClick={() => onSelect(game.id)}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
            activeId === game.id
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
          )}
        >
          <TeamLogo team={game.away_team} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="tracking-wider">
              {teamTricode(game.away_team)} @ {teamTricode(game.home_team)}
            </span>
            <CountdownBadge commenceTime={game.commence_time} size="sm" />
          </div>
          <TeamLogo team={game.home_team} />
        </button>
      ))}
    </div>
  );
}
