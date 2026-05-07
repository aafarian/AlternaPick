"use client";

import { useEffect, useRef, memo } from "react";
import type { LivePickData } from "@/lib/cards/live-types";
import { computePickDisplay } from "@/lib/cards/pick-display";
import { CATEGORY_LABELS, CATEGORY_SHORT_LABELS, CATEGORY_COLORS, formatPlayerSubtitle } from "@/lib/constants";
import { formatLiveStatus, formatGameTime } from "@/lib/format";
import type { StatCategory } from "@/lib/supabase/types";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Check, X, CheckCircle2, XCircle, Minus, Loader2, Flame } from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import { HEATSCORE_HIT_BASE } from "@/lib/heatscore/compute";
import { NOTCH_TIERS } from "@/lib/heatscore/constants";
import { cn } from "@/lib/utils";
import { notchNumberTint } from "@/components/props/NotchSelector";
import NotchBadge from "@/components/props/NotchBadge";

// SVG chevron patterns — fit within h-2 (8px) bar
const CHEVRON_RIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpolyline points='2,1 6,4 2,7' fill='none' stroke='rgba(255,255,255,0.28)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
const CHEVRON_LEFT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpolyline points='6,1 2,4 6,7' fill='none' stroke='rgba(255,255,255,0.28)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

interface LivePickRowProps {
  pick: LivePickData;
  variant?: "full" | "compact" | "condensed";
  /** When true, show quality bonus tokens instead of full heatscore */
  showQualityTokens?: boolean;
}

function LivePickRowInner({ pick, variant = "full", showQualityTokens = false }: LivePickRowProps) {
  // Track whether this is the initial render (for the bar grow animation).
  // Once the bar has grown, subsequent renders just set the width directly.
  const initialRenderRef = useRef(true);
  useEffect(() => {
    // Mark as no longer initial after first paint
    initialRenderRef.current = false;
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
          d.isDnp || d.isVoid ? (
            <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : d.settledWon ? (
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

        {/* Line + notch tier */}
        <span className={cn(
          "text-sm font-bold tabular-nums",
          notchNumberTint(pick.notch),
        )}>
          {pick.line ?? "\u2014"}
        </span>
        {pick.notch != null && pick.notch !== 0 && <NotchBadge notch={pick.notch} className="ml-1" />}

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
            {formatLiveStatus(pick.game_status.period, pick.game_status.clock, pick.sport, pick.game_status.home_score, pick.game_status.away_score)}
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

  // Condensed variant — compact single-line with inline progress bar
  if (variant === "condensed") {
    return (
      <div
        className={cn(
          "flex flex-col gap-1 border-l-2 px-4 py-1.5 transition-colors",
          d.accentClass,
          d.isSettled && "opacity-75"
        )}
      >
        {/* Info row */}
        <div className="flex items-center gap-2">
          {/* Settled icon */}
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              d.isSettled
                ? d.isDnp || d.isVoid
                  ? "bg-muted text-muted-foreground"
                  : d.settledWon
                    ? "bg-neon-green/15 text-neon-green"
                    : "bg-bold-red/15 text-bold-red"
                : "bg-transparent text-transparent"
            )}
          >
            {d.isSettled && (
              d.isDnp || d.isVoid ? (
                <Minus className="h-3 w-3" strokeWidth={3} />
              ) : d.settledWon ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <X className="h-3 w-3" strokeWidth={3} />
              )
            )}
          </div>

          {/* Avatar */}
          <PlayerAvatar
            playerId={pick.player_id}
            playerName={pick.player_name}
            sport={pick.sport}
            size="default"
            className="ring-1 ring-border/60"
          />

          {/* Player name + stat */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold leading-tight">
              {pick.player_name}
            </span>
            <div className="flex items-center gap-1">
              <span className={cn("text-[10px] font-semibold uppercase", statPillClass)}>
                {CATEGORY_SHORT_LABELS[statCat] ?? statCat}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {d.isOver ? "O" : "U"} {pick.line}
              </span>
            </div>
          </div>

          {/* Value + status */}
          <div className="flex shrink-0 items-center gap-2">
            {d.isDnp || d.isVoid ? (
              <span className="text-[10px] font-semibold text-muted-foreground">
                {d.isDnp ? "DNP" : "Void"}
              </span>
            ) : d.hasValue ? (
              <span className={cn(
                "text-lg font-black tabular-nums",
                d.isWinning ? "text-neon-green" : "text-bold-red"
              )}>
                {pick.current_value}
              </span>
            ) : d.isSettled ? (
              <span className={cn(
                "text-[10px] font-semibold",
                d.settledWon ? "text-neon-green" : "text-bold-red"
              )}>
                {d.settledWon ? "Hit" : "Miss"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/30">&mdash;</span>
            )}

            {d.isLive && pick.game_status && (
              <span className="flex items-center gap-1 text-[9px] font-semibold text-white/70">
                <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
                {formatLiveStatus(pick.game_status.period, pick.game_status.clock, pick.sport, pick.game_status.home_score, pick.game_status.away_score)}
              </span>
            )}
            {d.isFinal && !d.isSettled && (
              <span className="text-[9px] font-semibold text-white/50">Final</span>
            )}
          </div>
        </div>

        {/* Progress bar — ml-7 aligns with avatar (past settled icon + gap) */}
        <div className="relative ml-7 h-1.5 w-auto overflow-visible rounded-full bg-secondary/30">
          <div
            className="absolute -top-[2px] z-20"
            style={{ left: `${d.linePosition}%`, transform: "translateX(-50%)" }}
          >
            <svg width="6" height="10" viewBox="0 0 8 14">
              {d.isOver ? (
                <polygon points="0,0 8,7 0,14" fill="currentColor" className="text-foreground" />
              ) : (
                <polygon points="8,0 0,7 8,14" fill="currentColor" className="text-foreground" />
              )}
            </svg>
          </div>
          <div
            className={cn(
              "h-full overflow-hidden rounded-full transition-[width,background-color] duration-700 ease-out",
              d.barColor
            )}
            style={{ width: `${d.barWidth}%` }}
          />
        </div>
      </div>
    );
  }

  // Full variant (default) — My Cards live tracker
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-l-2 px-3 py-2 transition-colors",
        d.accentClass,
        d.isSettled && "opacity-75"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Settled icon — always reserves space to prevent layout shift */}
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
            d.isSettled
              ? d.isDnp || d.isVoid
                ? "bg-muted text-muted-foreground"
                : d.settledWon
                  ? "bg-neon-green/15 text-neon-green"
                  : "bg-bold-red/15 text-bold-red"
              : "bg-transparent text-transparent"
          )}
        >
          {d.isSettled && (
            d.isDnp || d.isVoid ? (
              <Minus className="h-3 w-3" strokeWidth={3} />
            ) : d.settledWon ? (
              <Check className="h-3 w-3" strokeWidth={3} />
            ) : (
              <X className="h-3 w-3" strokeWidth={3} />
            )
          )}
        </div>

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
              <span className="flex items-baseline gap-0.5">
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    d.isWinning ? "text-neon-green" : "text-bold-red"
                  )}
                >
                  {pick.current_value}
                </span>
                <span className="text-[10px] text-muted-foreground/40">/</span>
                <span className={cn(
                  "text-xs tabular-nums text-muted-foreground/60",
                  notchNumberTint(pick.notch),
                )}>
                  {pick.line}
                </span>
                {pick.notch != null && pick.notch !== 0 && <NotchBadge notch={pick.notch} className="ml-1" />}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className={cn(
                  "text-xs font-semibold tabular-nums text-muted-foreground",
                  notchNumberTint(pick.notch),
                )}>
                  {pick.line}
                </span>
                {pick.notch != null && pick.notch !== 0 && <NotchBadge notch={pick.notch} className="ml-1" />}
                {d.isAwaitingLive && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right: big current value + game status — fixed min-h to avoid layout shift */}
        <div className="flex min-h-[36px] flex-col items-end justify-center gap-1">
          {d.isDnp || d.isVoid ? (
            <span className="text-xs font-semibold leading-none text-muted-foreground">
              {d.isDnp ? "DNP" : "Void"}
            </span>
          ) : d.hasValue ? (
            <span
              className={cn(
                "text-xl font-black tabular-nums leading-none",
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

          {/* Per-pick score (resolved picks only) */}
          {d.isSettled && pick.heat_score != null && pick.heat_score !== 0 && (() => {
            // For wagered cards, show quality tokens (what contributed to payout)
            // For non-wagered, show full heatscore
            const notchMult = (pick.notch != null && pick.notch !== 0)
              ? (NOTCH_TIERS.find((t) => t.notch === pick.notch)?.multiplier ?? 1)
              : 1;
            const baseHitValue = pick.trending === "hit" ? Math.round(HEATSCORE_HIT_BASE * notchMult) : 0;
            const qualityTokens = pick.heat_score - baseHitValue;
            const displayValue = showQualityTokens ? qualityTokens : pick.heat_score;

            if (showQualityTokens && qualityTokens === 0) return null;

            return (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-xs font-bold tabular-nums leading-none",
                displayValue > 0 ? "text-emerald-500/80" : "text-red-400/70",
              )}>
                {showQualityTokens ? (
                  <FlameTokenIcon className="h-3 w-3 text-orange-400/70" />
                ) : (
                  <Flame className="h-3 w-3 text-orange-400/70" />
                )}
                {displayValue > 0 ? "+" : ""}{displayValue}
              </span>
            );
          })()}
          {d.isSettled && (pick.heat_score == null || pick.heat_score === 0) && pick.trending === "hit" && (
            <span className="text-[10px] font-semibold text-emerald-500/60">Hit</span>
          )}

          {d.isLive && pick.game_status && (
            <span className="flex items-center gap-1 text-[10px] font-semibold leading-none tabular-nums text-white/70">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {formatLiveStatus(pick.game_status.period, pick.game_status.clock, pick.sport, pick.game_status.home_score, pick.game_status.away_score)}
            </span>
          )}
          {d.isFinal && !d.isSettled && (
            <span className="text-[10px] font-semibold leading-none text-white/50">
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

      {/* Progress bar — ml-8 aligns with avatar (past settled icon + gap) */}
      <div className="relative ml-8 h-2 w-auto overflow-visible rounded-full bg-secondary/30">
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
            "relative h-full overflow-hidden rounded-full transition-[width,background-color] duration-700 ease-out",
            d.barColor
          )}
          style={{
            width: `${d.barWidth}%`,
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

const LivePickRow = memo(LivePickRowInner, (prev, next) => {
  // Only re-render if the pick data actually changed
  if (prev.variant !== next.variant) return false;
  if (prev.showQualityTokens !== next.showQualityTokens) return false;
  const p = prev.pick;
  const n = next.pick;
  return (
    p.pick_id === n.pick_id &&
    p.current_value === n.current_value &&
    p.trending === n.trending &&
    p.heat_score === n.heat_score &&
    p.line === n.line &&
    p.notch === n.notch &&
    p.game_status?.status === n.game_status?.status &&
    p.game_status?.period === n.game_status?.period &&
    p.game_status?.clock === n.game_status?.clock &&
    p.game_status?.home_score === n.game_status?.home_score &&
    p.game_status?.away_score === n.game_status?.away_score
  );
});
export default LivePickRow;
