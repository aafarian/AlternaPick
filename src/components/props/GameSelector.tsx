"use client";

import { useState } from "react";
import { teamTricode, teamLogoUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface GameInfo {
  id: string;
  away_team: string;
  home_team: string;
  commence_time: string;
}

interface GameSelectorProps {
  games: GameInfo[];
}

function formatTime(commenceTime: string): string {
  const date = new Date(commenceTime);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

export default function GameSelector({ games }: GameSelectorProps) {
  const [active, setActive] = useState<string | null>(null);

  function handleClick(gameId: string) {
    setActive(gameId);
    const el = document.getElementById(`game-${gameId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (games.length === 0) return null;

  return (
    <div className="flex w-full gap-2 overflow-x-auto scrollbar-none">
      {games.map((game) => (
        <button
          key={game.id}
          onClick={() => handleClick(game.id)}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
            active === game.id
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-secondary text-muted-foreground hover:border-border/80 hover:text-foreground"
          )}
        >
          <TeamLogo team={game.away_team} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="tracking-wider">
              {teamTricode(game.away_team)} @ {teamTricode(game.home_team)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatTime(game.commence_time)}
            </span>
          </div>
          <TeamLogo team={game.home_team} />
        </button>
      ))}
    </div>
  );
}
