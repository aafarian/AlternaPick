"use client";

import { useState } from "react";
import type { StatCategory } from "@/lib/supabase/types";
import { CATEGORY_LABELS, CATEGORY_TEXT_COLORS, CATEGORY_GLOW_COLORS, teamLogoUrl } from "@/lib/constants";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { usePlayerProfile } from "@/lib/players/player-profile-context";
import { getModeConfig } from "@/lib/modes/definitions";
import PlayerHeadshot from "@/components/props/PlayerHeadshot";
import NotchSelector from "@/components/props/NotchSelector";
import NotchBadge from "@/components/props/NotchBadge";
import { cn } from "@/lib/utils";
import { MAX_EASY_NOTCH_PICKS } from "@/lib/heatscore/constants";
import { isOverOnlyCategory } from "@/lib/sports/config";

interface PropLineProps {
  propId: string;
  gameId: string;
  playerName: string;
  playerId: string | null;
  playerTeam: string | null;
  playerPosition: string | null;
  statCategory: StatCategory;
  line: number;
  lineHistory: Array<{ t: string; l: number }> | null;
  sport?: string;
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
  lineHistory,
  sport,
}: PropLineProps) {
  const { addPick, removePick, isPickSelected, getSelection, isFull, state } =
    useCardBuilder();
  const { openProfile } = usePlayerProfile();

  // Notch state — local to each prop card
  const [notch, setNotch] = useState(0);

  // Track the current adjusted line for addPick
  const [currentAdjustedLine, setCurrentAdjustedLine] = useState(line);

  // For constrained modes (one_player/one_team), hide non-matching props
  const selected = isPickSelected(propId);
  const selection = getSelection(propId);

  if (state.picks.length > 0 && !selected) {
    const modeConfig = getModeConfig(state.gameMode);
    const anchor = state.picks[0];
    if (modeConfig.constraints.sameTeam && (playerTeam ?? "") !== anchor.player_team) {
      return null;
    }
    if (modeConfig.constraints.samePlayer && playerName !== anchor.player_name) {
      return null;
    }
  }

  // Count easy notch picks already in the card (excluding this prop if selected)
  const easyNotchCount = state.picks.filter(
    (p) => p.notch < 0 && p.prop_id !== propId,
  ).length;
  const canGoEasy = MAX_EASY_NOTCH_PICKS <= 0 || easyNotchCount < MAX_EASY_NOTCH_PICKS;

  const disabledUnselected = isFull && !selected;
  // Over-only categories (e.g. home runs) never allow "under" — under on a rare
  // event is a near-certain, exploitable win. See OVER_ONLY_CATEGORIES.
  const overOnly = isOverOnlyCategory(statCategory);
  const underDisabled = disabledUnselected || notch !== 0 || overOnly;

  function handleNotchChange(newNotch: number, newAdjustedLine: number) {
    // Block going to easy notch if limit reached
    if (newNotch < 0 && !canGoEasy && notch >= 0) return;

    setNotch(newNotch);
    setCurrentAdjustedLine(newAdjustedLine);

    if (selected) {
      // If user has Under selected and shifts notch away from 0, auto-remove
      if (selection === "under" && newNotch !== 0) {
        removePick(propId);
        return;
      }
      // Re-add the pick with the updated notch + adjusted_line
      removePick(propId);
      addPick({
        prop_id: propId,
        player_name: playerName,
        player_team: playerTeam ?? "",
        stat_category: statCategory,
        line,
        selection: selection ?? "over",
        game_id: gameId,
        notch: newNotch,
        adjusted_line: newAdjustedLine,
      });
    }
  }

  function handleClick(side: "over" | "under") {
    if (selected && selection === side) {
      // Deselecting is always allowed, even for an otherwise-disabled control.
      removePick(propId);
      setNotch(0);
      setCurrentAdjustedLine(line);
      return;
    }
    // Adding or switching selection: never act on a disabled control. The
    // buttons are already disabled in render — this guards programmatic calls
    // (e.g. an under pick on an over-only category) from corrupting state.
    if (side === "over" ? disabledUnselected : underDisabled) return;
    // Switching selection: drop the existing pick before re-adding with the new side.
    if (selected) removePick(propId);
    addPick({
      prop_id: propId,
      player_name: playerName,
      player_team: playerTeam ?? "",
      stat_category: statCategory,
      line,
      selection: side,
      game_id: gameId,
      notch,
      adjusted_line: currentAdjustedLine,
    });
  }

  // Only use the player's enriched team — falling back to homeTeam would show
  // the opponent's logo for away-team players whose enrichment is missing.
  const bgLogoUrl = playerTeam ? teamLogoUrl(playerTeam) : null;

  const glowColor = CATEGORY_GLOW_COLORS[statCategory];

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200",
        "bg-gradient-to-b from-white/[0.04] to-card",
        "shadow-[0_1px_3px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]",
        selected
          ? "ring-1 ring-primary/50 shadow-[0_0_20px_rgba(0,210,106,0.2),inset_0_1px_0_rgba(0,210,106,0.15)]"
          : "hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]"
      )}
    >
      {/* Category glow — faint gradient at the top edge */}
      <div className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-60",
        glowColor,
      )} />

      {/* Notch tier badge — top-left overlay, only when shifted */}
      {notch !== 0 && (
        <div className="absolute left-2 top-2 z-20">
          <NotchBadge notch={notch} />
        </div>
      )}

      {/* Center: player headshot with team logo background */}
      <div className="relative flex flex-col items-center px-2 pt-3 pb-2 sm:px-4 sm:pt-4">
        {/* Team logo watermark behind player */}
        {bgLogoUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgLogoUrl}
              alt=""
              className="h-28 w-28 object-contain opacity-[0.14] sm:h-40 sm:w-40"
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
                propContext: { line: currentAdjustedLine, statCategory },
              });
            }
          }}
        >
          <PlayerHeadshot playerId={playerId} playerName={playerName} sport={sport} responsive />

          {/* Player name */}
          <span className="mt-1 max-w-full truncate text-center text-xs font-bold leading-tight sm:text-sm">
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

      {/* Line number with notch selector + stat category */}
      <div className="flex flex-col items-center gap-0.5 pb-2">
        <div className="flex items-center justify-center gap-1.5">
          <NotchSelector
            baseLine={line}
            statCategory={statCategory}
            notch={notch}
            canGoEasy={canGoEasy}
            onNotchChange={handleNotchChange}
          />
          <span
            className={cn(
              "max-w-[4.5rem] truncate text-[10px] font-bold uppercase sm:max-w-none sm:text-xs",
              CATEGORY_TEXT_COLORS[statCategory]
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
      <div className="relative mt-auto grid grid-cols-2">
        {/* Divider line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <button
          onClick={() => handleClick("over")}
          disabled={disabledUnselected}
          className={cn(
            "cursor-pointer py-3 text-xs font-bold uppercase tracking-wider transition-all",
            selected && selection === "over"
              ? "bg-neon-green/15 text-neon-green"
              : disabledUnselected
                ? "cursor-not-allowed text-muted-foreground/30"
                : "text-muted-foreground/60 hover:bg-neon-green/5 hover:text-neon-green"
          )}
        >
          Over
        </button>
        <button
          onClick={() => handleClick("under")}
          disabled={underDisabled}
          className={cn(
            "relative cursor-pointer py-3 text-xs font-bold uppercase tracking-wider transition-all",
            "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-white/10",
            selected && selection === "under"
              ? "bg-bold-red/15 text-bold-red"
              : underDisabled
                ? "cursor-not-allowed text-muted-foreground/30"
                : "text-muted-foreground/60 hover:bg-bold-red/5 hover:text-bold-red"
          )}
        >
          Under
        </button>
      </div>
    </div>
  );
}
