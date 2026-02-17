"use client";

import Image from "next/image";
import { useState } from "react";
import { Target } from "lucide-react";
import type { StatCategory } from "@/lib/supabase/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, teamLogoUrl } from "@/lib/constants";
import { getPlayerHeadshotUrl, getHeadshotConfig } from "@/lib/sports";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { usePlayerProfile } from "@/lib/players/player-profile-context";
import { getModeConfig } from "@/lib/modes/definitions";
import { getInitials } from "@/lib/format/name-utils";
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
  /** User's historical accuracy rate (0-1) for this prop's player/category */
  edgeRate?: number;
  sport?: string;
}

function PlayerHeadshot({
  playerId,
  playerName,
  sport,
}: {
  playerId: string | null;
  sport?: string;
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

  const hs = getHeadshotConfig(sport);

  return (
    <div className="relative h-[100px] w-[130px]">
      <Image
        src={getPlayerHeadshotUrl(playerId, sport)}
        alt={playerName}
        width={hs.width}
        height={hs.height}
        unoptimized={hs.isProxied}
        className={cn(
          "relative z-10 object-contain drop-shadow-lg",
          hs.isProxied ? "mx-auto object-bottom" : "object-bottom"
        )}
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
  edgeRate,
  sport,
}: PropLineProps) {
  const { addPick, removePick, isPickSelected, getSelection, isFull, state } =
    useCardBuilder();
  const { openProfile } = usePlayerProfile();

  // For existing challenges with constrained modes, hide non-matching props
  const selected = isPickSelected(propId);
  if (state.challengeId && state.picks.length > 0 && !selected) {
    const modeConfig = getModeConfig(state.gameMode);
    const anchor = state.picks[0];
    if (modeConfig.constraints.sameTeam && (playerTeam ?? "") !== anchor.player_team) {
      return null;
    }
    if (modeConfig.constraints.samePlayer && playerName !== anchor.player_name) {
      return null;
    }
  }

  const selection = getSelection(propId);

  function handleClick(side: "over" | "under") {
    if (selected && selection === side) {
      removePick(propId);
    } else if (selected) {
      removePick(propId);
      addPick({
        prop_id: propId,
        player_name: playerName,
        player_team: playerTeam ?? "",
        stat_category: statCategory,
        line,
        selection: side,
        game_id: gameId,
      });
    } else {
      addPick({
        prop_id: propId,
        player_name: playerName,
        player_team: playerTeam ?? "",
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

        <button
          type="button"
          className="relative z-10 flex cursor-pointer flex-col items-center"
          onClick={() => {
            if (playerId) {
              openProfile({
                playerId,
                playerName,
                playerTeam,
                playerPosition,
                sport,
                propContext: { line, statCategory },
              });
            }
          }}
        >
          <PlayerHeadshot playerId={playerId} playerName={playerName} sport={sport} />

          {/* Player name */}
          <span className="mt-1 truncate text-center text-sm font-bold leading-tight">
            {playerName}
          </span>

          {/* Team abbreviation + position */}
          {playerTeam && (
            <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              {playerTeam}{playerPosition ? ` - ${playerPosition}` : ""}
            </span>
          )}
        </button>
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

        {/* "Your Edge" indicator for users with strong historical accuracy */}
        {edgeRate !== undefined && (
          <span
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-neon-green"
            title={`Your Edge: ${Math.round(edgeRate * 100)}% accuracy`}
          >
            <Target size={12} className="shrink-0" />
            {Math.round(edgeRate * 100)}% accuracy
          </span>
        )}
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
