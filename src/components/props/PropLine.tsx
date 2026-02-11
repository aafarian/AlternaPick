"use client";

import Image from "next/image";
import { useState } from "react";
import type { StatCategory } from "@/lib/supabase/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, teamLogoUrl, getPlayerHeadshotUrl } from "@/lib/constants";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { cn } from "@/lib/utils";

interface PropLineProps {
  propId: string;
  gameId: string;
  playerName: string;
  playerId: string | null;
  playerTeam: string | null;
  playerPosition: string | null;
  statCategory: StatCategory;
  line: number;
  awayTeam: string;
  homeTeam: string;
  lineHistory: Array<{ t: string; l: number }> | null;
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function PlayerHeadshot({
  playerId,
  playerName,
}: {
  playerId: string | null;
  playerName: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (!playerId || imgError) {
    return (
      <div className="flex h-[100px] w-[130px] items-end justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {getInitials(playerName)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100px] w-[130px]">
      <Image
        src={getPlayerHeadshotUrl(playerId)}
        alt={playerName}
        width={130}
        height={100}
        className="relative z-10 object-contain object-bottom drop-shadow-lg"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

export default function PropLine({
  propId,
  gameId,
  playerName,
  playerId,
  playerTeam,
  playerPosition,
  statCategory,
  line,
  awayTeam,
  homeTeam,
  lineHistory,
}: PropLineProps) {
  const { addPick, removePick, isPickSelected, getSelection, isFull } =
    useCardBuilder();

  const selected = isPickSelected(propId);
  const selection = getSelection(propId);

  function handleClick(side: "over" | "under") {
    if (selected && selection === side) {
      removePick(propId);
    } else if (selected) {
      removePick(propId);
      addPick({
        prop_id: propId,
        player_name: playerName,
        stat_category: statCategory,
        line,
        selection: side,
        game_id: gameId,
      });
    } else {
      addPick({
        prop_id: propId,
        player_name: playerName,
        stat_category: statCategory,
        line,
        selection: side,
        game_id: gameId,
      });
    }
  }

  const disabledUnselected = isFull && !selected;

  // Determine which team logo to show as background
  const bgTeam = playerTeam || homeTeam;
  const bgLogoUrl = teamLogoUrl(bgTeam);

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all",
        selected
          ? "border-primary/40 shadow-[0_0_24px_rgba(0,210,106,0.15)]"
          : "hover:border-border/80"
      )}
    >
      {/* Center: player headshot with team logo background */}
      <div className="relative flex flex-col items-center px-4 pt-4 pb-2">
        {/* Team logo watermark behind player */}
        {bgLogoUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgLogoUrl}
              alt=""
              className="h-40 w-40 object-contain opacity-[0.14]"
            />
          </div>
        )}

        {/* Radial glow behind player */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "h-24 w-24 rounded-full opacity-30 blur-2xl",
              selected ? "bg-primary" : "bg-muted-foreground/30"
            )}
          />
        </div>

        <PlayerHeadshot playerId={playerId} playerName={playerName} />

        {/* Player name */}
        <span className="relative z-10 mt-1 truncate text-center text-sm font-bold leading-tight">
          {playerName}
        </span>

        {/* Team abbreviation + position */}
        {playerTeam && (
          <span className="relative z-10 mt-0.5 text-[11px] font-medium text-muted-foreground">
            {playerTeam}{playerPosition ? ` - ${playerPosition}` : ""}
          </span>
        )}
      </div>

      {/* Line number + stat category */}
      <div className="flex flex-col items-center gap-0.5 pb-2">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-3xl font-black tabular-nums tracking-tight">
            {line}
          </span>
          <span
            className={cn(
              "text-xs font-bold uppercase",
              CATEGORY_COLORS[statCategory].replace(/bg-\S+\s*/, "")
            )}
          >
            {CATEGORY_LABELS[statCategory]}
          </span>
        </div>
        {lineHistory && lineHistory.length >= 2 && (() => {
          const openLine = lineHistory[0].l;
          const diff = line - openLine;
          if (diff === 0) return null;
          const arrow = diff > 0 ? "\u2191" : "\u2193";
          const color = diff > 0 ? "text-neon-green" : "text-bold-red";
          return (
            <span className={cn("text-[10px] font-medium", color)}>
              opened {openLine} {arrow}
            </span>
          );
        })()}
      </div>

      {/* Over / Under buttons */}
      <div className="grid grid-cols-2 gap-px border-t border-border">
        <button
          onClick={() => handleClick("over")}
          disabled={disabledUnselected}
          className={cn(
            "cursor-pointer py-3 text-xs font-bold uppercase tracking-wider transition-all",
            selected && selection === "over"
              ? "bg-neon-green/15 text-neon-green"
              : disabledUnselected
                ? "cursor-not-allowed text-muted-foreground/30"
                : "text-muted-foreground hover:bg-neon-green/5 hover:text-neon-green"
          )}
        >
          Over
        </button>
        <button
          onClick={() => handleClick("under")}
          disabled={disabledUnselected}
          className={cn(
            "cursor-pointer border-l border-border py-3 text-xs font-bold uppercase tracking-wider transition-all",
            selected && selection === "under"
              ? "bg-bold-red/15 text-bold-red"
              : disabledUnselected
                ? "cursor-not-allowed text-muted-foreground/30"
                : "text-muted-foreground hover:bg-bold-red/5 hover:text-bold-red"
          )}
        >
          Under
        </button>
      </div>
    </div>
  );
}
