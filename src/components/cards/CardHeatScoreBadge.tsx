"use client";

import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Flame, HelpCircle } from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import HeatScoreModal from "@/components/onboarding/HeatScoreModal";
import { getHeatScoreMultiplier } from "@/lib/heatscore/constants";
import { getNotchTier, computeWagerNotchScale } from "@/lib/heatscore/compute";
import { cn } from "@/lib/utils";

interface CardHeatScoreBadgeProps {
  /** Raw HeatScore value (per-pick additive). */
  heatScore?: number | null;
  /** Flame token wager amount. */
  wager?: number | null;
  /** Flame token payout (after resolution). */
  payout?: number | null;
  /** Card size (number of picks). Used to show max multiplier for live wagered cards. */
  cardSize?: number;
  /** Notch values for each pick on the card (for difficulty-adjusted multiplier display). */
  pickNotches?: number[];
  /** Card score (hits) — used to compute actual multiplier on resolved cards. */
  score?: number;
  /** Total scoreable picks — used with score to compute multiplier. */
  totalPicks?: number;
  className?: string;
}

export default function CardHeatScoreBadge({
  heatScore,
  wager,
  payout,
  cardSize,
  pickNotches,
  score,
  totalPicks,
  className,
}: CardHeatScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showHeatInfo, setShowHeatInfo] = useState(false);
  const [anchorRight, setAnchorRight] = useState(true);
  const wagerRef = useRef<HTMLSpanElement>(null);
  const hasWager = wager != null;
  const hasHS = heatScore != null;

  /** Determine which side to anchor the tooltip based on badge position. */
  const openTooltip = useCallback(() => {
    if (wagerRef.current) {
      const rect = wagerRef.current.getBoundingClientRect();
      // If the badge's right edge is past the midpoint, anchor right; otherwise left
      setAnchorRight(rect.right > window.innerWidth / 2);
    }
    setShowTooltip(true);
  }, []);

  const baseMultiplier = cardSize ? getHeatScoreMultiplier(cardSize, cardSize) : null;

  // Wager notch scale: 2D lookup by notch tier + effective card size.
  // For resolved cards, use totalPicks (scoreable size after DNP/push) to
  // match the server-side resolution.ts calculation.
  const notchScaleSize = (payout != null && totalPicks != null && totalPicks > 0) ? totalPicks : cardSize;
  const wagerNotchScale = pickNotches && pickNotches.length > 0
    ? computeWagerNotchScale(pickNotches, notchScaleSize)
    : 1;
  const effectiveMultiplier = baseMultiplier != null
    ? Math.round(Math.min(baseMultiplier * wagerNotchScale, 500) * 10) / 10
    : baseMultiplier;

  // Build base multiplier rows — use effective size (totalPicks) for resolved cards,
  // original cardSize for live cards (DNPs haven't happened yet)
  const effectiveSize = (payout != null && totalPicks != null && totalPicks > 0) ? totalPicks : cardSize;
  const baseRows = effectiveSize
    ? Array.from({ length: effectiveSize + 1 }, (_, i) => effectiveSize - i).map((hits) => ({
        hits,
        multiplier: getHeatScoreMultiplier(hits, effectiveSize),
      }))
    : [];

  // Build notch line items for tooltip
  // Determine if this card uses a non-Standard notch tier
  const cardNotch = pickNotches && pickNotches.length > 0 ? pickNotches[0] : 0;
  const hasNotchBonus = cardNotch !== 0;
  const isResolved = payout != null || (hasHS && !hasWager);

  // For resolved wagered cards: compute the actual multiplier
  const actualMultiplier = (score != null && totalPicks != null && totalPicks > 0)
    ? getHeatScoreMultiplier(score, totalPicks)
    : null;
  const actualEffective = actualMultiplier != null
    ? Math.round(Math.min(actualMultiplier * wagerNotchScale, 500) * 10) / 10
    : null;

  if (!hasWager && !hasHS) return null;

  return (
    <span className={cn("relative inline-flex items-center gap-3", className)}>
      {/* HeatScore badge (non-wagered cards only) */}
      {hasHS && !hasWager && (
        <span
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          tabIndex={0}
          role="group"
          aria-label={`HeatScore: ${heatScore}`}
        >
          <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-xs px-2 py-0.5 gap-1">
            <Flame className="h-3 w-3" />
            {heatScore}
          </Badge>

          {/* HeatScore tooltip */}
          {showTooltip && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card p-2 shadow-lg text-[10px] font-normal">
              <p className="font-semibold text-foreground mb-1">HeatScore</p>
              <p className="text-muted-foreground">Each hit: +130 × notch multiplier</p>
              <p className="text-muted-foreground">Quality bonus from margins</p>
              <div className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHeatInfo(true);
                    setShowTooltip(false);
                  }}
                  className="flex w-full items-center justify-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <HelpCircle className="h-2.5 w-2.5" />
                  What is HeatScore?
                </button>
              </div>
            </div>
          )}
        </span>
      )}

      {/* Wager display (wagered cards only) */}
      {hasWager && (
        <span
          ref={wagerRef}
          className="relative inline-flex items-center"
          onMouseEnter={openTooltip}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Live card: wager + "up to Xx" */}
          {!isResolved && (
            <span className="inline-flex items-center gap-2 text-sm font-bold">
              <span className="inline-flex items-center gap-1 text-orange-400">
                <FlameTokenIcon className="h-3.5 w-3.5" />
                -{wager}
              </span>
              {effectiveMultiplier != null && effectiveMultiplier > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="font-black text-emerald-500">
                    <span className="hidden sm:inline">up to </span>{effectiveMultiplier}x
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (showTooltip) setShowTooltip(false);
                      else openTooltip();
                    }}
                    className="p-1.5 -m-1.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                    aria-label="View payout multipliers"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </span>
          )}

          {/* Resolved card: wager + multiplier + payout with breakdown */}
          {isResolved && (
            <span className="inline-flex items-center gap-2 text-sm font-black">
              <FlameTokenIcon className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-orange-400">-{wager}</span>
              {actualEffective != null && actualEffective > 0 && (
                <span className="text-xs font-bold text-emerald-500/70">{actualEffective}x</span>
              )}
              <span className={payout != null && payout > 0 ? "text-emerald-500" : "text-muted-foreground"}>
                +{payout ?? 0}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (showTooltip) setShowTooltip(false);
                  else openTooltip();
                }}
                className="p-1.5 -m-1.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label="View payout breakdown"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </span>
          )}

          {/* Tooltip: payout rates (live) or payout breakdown (resolved) */}
          {showTooltip && (
            <>
            {/* Backdrop to dismiss on mobile tap-away */}
            <div
              className="fixed inset-0 z-40 sm:hidden"
              onClick={() => setShowTooltip(false)}
              aria-hidden="true"
            />
            <div
              className={cn(
                "absolute top-full z-50 mt-1.5 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 shadow-lg text-[10px] font-normal",
                anchorRight ? "right-0" : "left-0",
              )}
              onMouseLeave={() => setShowTooltip(false)}
            >
              {/* Resolved: show payout rates + breakdown */}
              {isResolved && payout != null && wager != null && (
                <>
                  {/* Payout rates table with user's result highlighted */}
                  <p className="mb-1.5 text-xs font-semibold text-foreground">Payout Rates</p>
                  <div className="flex flex-col gap-0.5">
                    {baseRows.map(({ hits, multiplier }) => {
                      const isActual = hits === (score ?? -1);
                      return (
                        <div key={hits} className={cn(
                          "flex items-center justify-between rounded px-1 py-0.5",
                          isActual && "bg-primary/10",
                        )}>
                          <span className={cn("text-[11px]", isActual ? "font-bold text-foreground" : "text-muted-foreground")}>
                            {hits}/{effectiveSize ?? 0} picks {isActual ? "← you" : ""}
                          </span>
                          <span className={cn(
                            "text-[11px] font-bold",
                            isActual ? (multiplier > 0 ? "text-emerald-500" : "text-red-400") : multiplier > 0 ? "text-emerald-500/60" : "text-red-400/60",
                          )}>
                            {multiplier > 0 ? `${multiplier}x` : "Bust"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Breakdown */}
                  <div className="my-2 border-t border-border" />
                  <p className="mb-1.5 text-xs font-semibold text-foreground">Your Payout</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Wager</span>
                      <span className="text-[11px] font-bold text-orange-400">{wager}</span>
                    </div>
                    {actualEffective != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Multiplier</span>
                        <span className={cn("text-[11px] font-bold", actualEffective > 0 ? "text-emerald-500" : "text-red-400")}>
                          {actualEffective > 0 ? `${actualEffective}x` : "Bust"}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border mt-0.5 pt-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Total payout</span>
                      <span className={cn("text-xs font-black", payout > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                        {payout}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Net</span>
                      <span className={cn(
                        "text-[11px] font-bold",
                        payout > wager ? "text-emerald-500" : payout < wager ? "text-red-400" : "text-muted-foreground",
                      )}>
                        {payout - wager >= 0 ? "+" : ""}{payout - wager}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Live: show payout rates + difficulty + max */}
              {!isResolved && (
                <>
                  <p className="mb-1.5 font-semibold text-foreground">Payout Rates</p>
                  <div className="flex flex-col gap-0.5">
                    {baseRows.map(({ hits, multiplier }) => (
                      <div key={hits} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{hits}/{cardSize} picks</span>
                        <span className={cn("font-bold", multiplier > 0 ? "text-emerald-500" : "text-red-400")}>
                          {multiplier > 0 ? `${multiplier}x` : "Bust"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {hasNotchBonus && (
                    <>
                      <div className="my-1.5 border-t border-border" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Difficulty</span>
                        <span className="font-bold text-orange-400">{getNotchTier(cardNotch).label}</span>
                      </div>
                    </>
                  )}

                  {wager != null && effectiveMultiplier != null && (
                    <>
                      <div className="my-1.5 border-t border-border" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Max payout</span>
                        <span className="font-black text-emerald-500">{Math.round(wager * effectiveMultiplier).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            </>
          )}
        </span>
      )}

      <HeatScoreModal open={showHeatInfo} onClose={() => setShowHeatInfo(false)} />
    </span>
  );
}
