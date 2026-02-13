"use client";

import type { LivePickData } from "@/lib/cards/live-types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import { formatClock, formatGameTime } from "@/lib/format";
import type { StatCategory } from "@/lib/supabase/types";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Check, X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// SVG chevron patterns — fit within h-2 (8px) bar
const CHEVRON_RIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpolyline points='2,1 6,4 2,7' fill='none' stroke='rgba(255,255,255,0.28)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
const CHEVRON_LEFT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpolyline points='6,1 2,4 6,7' fill='none' stroke='rgba(255,255,255,0.28)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

interface LivePickRowProps {
  pick: LivePickData;
  variant?: "full" | "compact";
}

export default function LivePickRow({ pick, variant = "full" }: LivePickRowProps) {
  const statCat = pick.stat_category as StatCategory;

  const hasValue = pick.current_value !== null;
  const isOver = pick.selection === "over";
  const isLive = pick.game_status?.status === "live";
  const isFinal = pick.game_status?.status === "final";
  const isPreGame =
    !pick.game_status || pick.game_status.status === "scheduled";
  // Fallback pick = no game_status and no value → live data is still loading
  const isAwaitingLive = !pick.game_status && !hasValue;

  // Progress toward the line
  const rawPct =
    hasValue && pick.line > 0 ? (pick.current_value! / pick.line) * 100 : 0;
  const pastLine = rawPct >= 100;

  // Line marker fixed at 90%; bar scales within that range or fills 100% when over
  const linePosition = 90;
  const barWidth = pastLine ? 100 : (rawPct / 100) * 90;

  // Settled: line is decided and won't change
  // - Stats only go up, so once over the line -> settled
  // - Game final -> settled
  // - No game_status + non-null trending -> resolved challenge pick
  const isSettled =
    hasValue &&
    (isFinal || pastLine || (!pick.game_status && pick.trending !== null));
  const settledWon = isSettled
    ? pastLine === isOver // over + went over = won, under + stayed under = won
    : null;

  // Still in play: has live data but not settled yet
  const inPlay = isLive && !isSettled;

  // Bar color — green when winning, red when losing
  const isWinning = hasValue && (isOver ? pastLine : !pastLine);
  const barColor = !hasValue
    ? "bg-foreground/12"
    : isWinning
      ? "bg-neon-green/30"
      : "bg-bold-red/25";

  // Left accent border — only when settled
  const accentClass = isSettled
    ? settledWon
      ? "border-l-neon-green/60"
      : "border-l-bold-red/60"
    : "border-l-transparent";

  const statPillClass = CATEGORY_COLORS[statCat] ?? "";

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2",
          isSettled && "opacity-75"
        )}
      >
        {/* Settled icon */}
        {isSettled && (
          settledWon ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-green" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-bold-red" />
          )
        )}

        {/* Player name */}
        <span className="truncate text-sm font-medium">
          {pick.player_name}
        </span>

        {/* Stat pill */}
        <Badge
          variant="secondary"
          className={cn("shrink-0 text-xs", statPillClass)}
        >
          {CATEGORY_LABELS[statCat] ?? statCat}
        </Badge>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Current value */}
        {hasValue && (
          <span
            className={cn(
              "text-sm font-black tabular-nums",
              isWinning ? "text-neon-green" : "text-bold-red"
            )}
          >
            {pick.current_value}
          </span>
        )}

        {/* Line */}
        <span className="text-sm font-bold tabular-nums">
          {pick.line || "\u2014"}
        </span>

        {/* Over/Under badge */}
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 text-xs",
            isOver
              ? "bg-neon-green/15 text-neon-green"
              : "bg-bold-red/15 text-bold-red"
          )}
        >
          {isOver ? "Over" : "Under"}
        </Badge>

        {/* Game clock */}
        {isLive && pick.game_status && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-white/70">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {formatClock(pick.game_status.period, pick.game_status.clock)}
          </span>
        )}
        {isFinal && (
          <span className="shrink-0 text-[10px] font-semibold text-white/50">
            Final
          </span>
        )}
        {isPreGame && !isSettled && (
          <span className="shrink-0 text-[10px] font-semibold text-white/70">
            {pick.game_status?.commence_time
              ? formatGameTime(pick.game_status.commence_time)
              : "Scheduled"}
          </span>
        )}
      </div>
    );
  }

  // Full variant (default) — My Cards live tracker
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-l-2 px-4 py-3 transition-colors",
        accentClass,
        isSettled && "opacity-75"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Settled icon */}
        {isSettled && (
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              settledWon
                ? "bg-neon-green/15 text-neon-green"
                : "bg-bold-red/15 text-bold-red"
            )}
          >
            {settledWon ? (
              <Check className="h-3 w-3" strokeWidth={3} />
            ) : (
              <X className="h-3 w-3" strokeWidth={3} />
            )}
          </div>
        )}

        {/* Avatar — always shown */}
        <PlayerAvatar
          playerId={pick.player_id}
          playerName={pick.player_name}
          size="lg"
          className="ring-1 ring-border/60"
        />

        {/* Player info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold leading-tight">
            {pick.player_name}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
                statPillClass
              )}
            >
              {CATEGORY_LABELS[statCat] ?? statCat}
            </Badge>
            {isOver ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {hasValue ? (
              <span className="flex items-baseline gap-0.5 animate-value-in">
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    isWinning ? "text-neon-green" : "text-bold-red"
                  )}
                >
                  {pick.current_value}
                </span>
                <span className="text-[10px] text-muted-foreground/40">/</span>
                <span className="text-xs tabular-nums text-muted-foreground/60">
                  {pick.line}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {pick.line}
                </span>
                {isAwaitingLive && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right: big current value + game status — fixed min-h to avoid layout shift */}
        <div className="flex min-h-[36px] flex-col items-end justify-center gap-1">
          {hasValue ? (
            <span
              className={cn(
                "text-xl font-black tabular-nums leading-none animate-value-in",
                isWinning ? "text-neon-green" : "text-bold-red"
              )}
            >
              {pick.current_value}
            </span>
          ) : isFinal ? (
            <span className="text-xs font-medium leading-none text-muted-foreground/50">
              Pending
            </span>
          ) : isAwaitingLive ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          ) : (
            <span className="text-base leading-none text-muted-foreground/30">
              &mdash;
            </span>
          )}

          {isLive && pick.game_status && (
            <span className="flex items-center gap-1 text-[10px] font-semibold leading-none tabular-nums text-white/70 animate-value-in">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {formatClock(pick.game_status.period, pick.game_status.clock)}
            </span>
          )}
          {isFinal && (
            <span className="text-[10px] font-semibold leading-none text-white/50 animate-value-in">
              Final
            </span>
          )}
          {isPreGame && !isAwaitingLive && (
            <span className="text-[10px] font-semibold leading-none text-white/70">
              {pick.game_status?.commence_time
                ? formatGameTime(pick.game_status.commence_time)
                : "Scheduled"}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar — always rendered so width animates from 0% when data arrives */}
      <div className="relative h-2 w-full overflow-visible rounded-full bg-secondary/30">
        {/* Line marker — triangle pointing toward the pick direction */}
        <div
          className="absolute -top-[3px] z-20 transition-[left] duration-700 ease-out"
          style={{
            left: `${linePosition}%`,
            transform: "translateX(-50%)",
          }}
        >
          <svg
            width="8"
            height="14"
            viewBox="0 0 8 14"
          >
            {isOver ? (
              <polygon points="0,0 8,7 0,14" fill="currentColor" className="text-foreground" />
            ) : (
              <polygon points="8,0 0,7 8,14" fill="currentColor" className="text-foreground" />
            )}
          </svg>
        </div>

        {/* Colored fill */}
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out",
            barColor
          )}
          style={{
            width: `${barWidth}%`,
          }}
        >
          {/* Chevron pattern — only when in play */}
          {!isSettled && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: isOver ? CHEVRON_RIGHT : CHEVRON_LEFT,
                backgroundRepeat: "repeat",
                backgroundSize: "8px 8px",
              }}
            />
          )}

          {/* Shimmer — only when in play */}
          {inPlay && (
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-y-0 w-1/3 animate-bar-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
