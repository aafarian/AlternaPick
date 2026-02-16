"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

const SCROLL_SPEED = 3;

export default function GameSelector({ games, activeId, onSelect }: GameSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollDir = useRef<"left" | "right" | null>(null);
  const rafRef = useRef<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, games]);

  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !scrollDir.current) return;
    el.scrollLeft += scrollDir.current === "right" ? SCROLL_SPEED : -SCROLL_SPEED;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startScroll = useCallback((dir: "left" | "right") => {
    scrollDir.current = dir;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopScroll = useCallback(() => {
    scrollDir.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  if (games.length === 0) return null;

  return (
    <div className="relative">
      {/* Left fade + hover zone */}
      <div
        onMouseEnter={() => startScroll("left")}
        onMouseLeave={stopScroll}
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
          canScrollLeft ? "pointer-events-auto opacity-100" : "opacity-0"
        )}
      />

      {/* Right fade + hover zone */}
      <div
        onMouseEnter={() => startScroll("right")}
        onMouseLeave={stopScroll}
        className={cn(
          "pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
          canScrollRight ? "pointer-events-auto opacity-100" : "opacity-0"
        )}
      />

      <div
        ref={scrollRef}
        className="flex w-full gap-2 overflow-x-auto overflow-y-hidden scrollbar-none"
      >
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
    </div>
  );
}
