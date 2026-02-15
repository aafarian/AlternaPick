"use client";

import { useState, useEffect } from "react";
import type { LivePickData } from "@/lib/cards/live-types";
import { computePickDisplay } from "@/lib/cards/pick-display";
import { CATEGORY_LABELS, CATEGORY_COLORS, formatPlayerSubtitle } from "@/lib/constants";
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
  // Mount at 0% width, then animate to target after a frame
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const statCat = pick.stat_category as StatCategory;
  const d = computePickDisplay(pick);
  const subtitle = formatPlayerSubtitle(pick.player_team, pick.player_position, pick.sport);
  const statPillClass = CATEGORY_COLORS[statCat] ?? "";

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2",
          d.isSettled && "opacity-75"
        )}
      >
        {/* Settled icon */}
        {d.isSettled && (
          d.settledWon ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-green" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-bold-red" />
          )
        )}

        {/* Player name + subtitle */}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {pick.player_name}
          </span>
          {subtitle && (
            <span className="truncate text-[10px] font-medium text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>

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
        {d.hasValue && (
          <span
            className={cn(
              "text-sm font-black tabular-nums",
              d.isWinning ? "text-neon-green" : "text-bold-red"
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
            d.isOver
              ? "bg-neon-green/15 text-neon-green"
              : "bg-bold-red/15 text-bold-red"
          )}
        >
          {d.isOver ? "Over" : "Under"}
        </Badge>

        {/* Game clock */}
        {d.isLive && pick.game_status && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-white/70">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {formatClock(pick.game_status.period, pick.game_status.clock)}
          </span>
        )}
        {d.isFinal && (
          <span className="shrink-0 text-[10px] font-semibold text-white/50">
            Final
          </span>
        )}
        {d.isPreGame && !d.isSettled && (
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
        d.accentClass,
        d.isSettled && "opacity-75"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Settled icon */}
        {d.isSettled && (
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              d.settledWon
                ? "bg-neon-green/15 text-neon-green"
                : "bg-bold-red/15 text-bold-red"
            )}
          >
            {d.settledWon ? (
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
          sport={pick.sport}
          size="lg"
          className="ring-1 ring-border/60"
        />

        {/* Player info */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold leading-tight">
            {pick.player_name}
          </span>
          {subtitle && (
            <span className="truncate text-[10px] font-medium text-muted-foreground">
              {subtitle}
            </span>
          )}
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
            {d.isOver ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {d.hasValue ? (
              <span className="flex items-baseline gap-0.5 animate-value-in">
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    d.isWinning ? "text-neon-green" : "text-bold-red"
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
                {d.isAwaitingLive && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right: big current value + game status — fixed min-h to avoid layout shift */}
        <div className="flex min-h-[36px] flex-col items-end justify-center gap-1">
          {d.hasValue ? (
            <span
              className={cn(
                "text-xl font-black tabular-nums leading-none animate-value-in",
                d.isWinning ? "text-neon-green" : "text-bold-red"
              )}
            >
              {pick.current_value}
            </span>
          ) : d.isSettled ? (
            <span
              className={cn(
                "text-xs font-semibold leading-none",
                d.settledWon ? "text-neon-green" : "text-bold-red"
              )}
            >
              {d.settledWon ? "Hit" : "Miss"}
            </span>
          ) : d.isFinal ? (
            <span className="text-xs font-medium leading-none text-muted-foreground/50">
              Pending
            </span>
          ) : d.isAwaitingLive ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          ) : (
            <span className="text-base leading-none text-muted-foreground/30">
              &mdash;
            </span>
          )}

          {d.isLive && pick.game_status && (
            <span className="flex items-center gap-1 text-[10px] font-semibold leading-none tabular-nums text-white/70 animate-value-in">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {formatClock(pick.game_status.period, pick.game_status.clock)}
            </span>
          )}
          {d.isFinal && (
            <span className="text-[10px] font-semibold leading-none text-white/50 animate-value-in">
              Final
            </span>
          )}
          {d.isPreGame && !d.isAwaitingLive && (
            <span className="text-[10px] font-semibold leading-none text-white/70">
              {pick.game_status?.commence_time
                ? formatGameTime(pick.game_status.commence_time)
                : "Scheduled"}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar — mounts at 0% then animates to target width */}
      <div className="relative h-2 w-full overflow-visible rounded-full bg-secondary/30">
        {/* Line marker — triangle pointing toward the pick direction */}
        <div
          className="absolute -top-[3px] z-20"
          style={{
            left: `${d.linePosition}%`,
            transform: "translateX(-50%)",
          }}
        >
          <svg
            width="8"
            height="14"
            viewBox="0 0 8 14"
          >
            {d.isOver ? (
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
            d.barColor
          )}
          style={{
            width: mounted ? `${d.barWidth}%` : "0%",
          }}
        >
          {/* Chevron pattern — only when in play */}
          {!d.isSettled && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: d.isOver ? CHEVRON_RIGHT : CHEVRON_LEFT,
                backgroundRepeat: "repeat",
                backgroundSize: "8px 8px",
              }}
            />
          )}

          {/* Shimmer — only when in play */}
          {d.inPlay && (
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
