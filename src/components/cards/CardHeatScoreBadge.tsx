"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Flame, HelpCircle } from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import HeatScoreModal from "@/components/onboarding/HeatScoreModal";
import { getHeatScoreMultiplier, WAGER_NOTCH_SCALE } from "@/lib/heatscore/constants";
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
  const hasWager = wager != null;
  const hasHS = heatScore != null;

  const baseMultiplier = cardSize ? getHeatScoreMultiplier(cardSize, cardSize) : null;

  // Wager notch scale: geometric mean of per-pick scales (matches payout formula)
  const wagerNotchScale = pickNotches && pickNotches.length > 0
    ? computeWagerNotchScale(pickNotches)
    : 1;
  const effectiveMultiplier = baseMultiplier != null
    ? Math.round(baseMultiplier * wagerNotchScale * 10) / 10
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
  const notchLineItems = (() => {
    if (!pickNotches) return [];
    const tierCounts = new Map<number, number>();
    for (const n of pickNotches) {
      tierCounts.set(n, (tierCounts.get(n) ?? 0) + 1);
    }
    const total = pickNotches.length;
    return Array.from(tierCounts.entries())
      .filter(([n]) => n !== 0)
      .sort(([a], [b]) => b - a)
      .map(([notch, count]) => {
        const tier = getNotchTier(notch);
        const wagerScale = WAGER_NOTCH_SCALE[notch] ?? 1;
        const cardImpact = Math.round(Math.pow(wagerScale, count / total) * 100) / 100;
        return { label: tier.label, cardImpact, isHarder: wagerScale > 1, count };
      });
  })();

  const hasNotchBonus = notchLineItems.length > 0;
  const isResolved = payout != null || (hasHS && !hasWager);

  // For resolved wagered cards: compute the base payout and quality bonus
  const actualMultiplier = (score != null && totalPicks != null && totalPicks > 0)
    ? getHeatScoreMultiplier(score, totalPicks)
    : null;
  // Display value (rounded for UI)
  const actualEffective = actualMultiplier != null
    ? Math.round(actualMultiplier * wagerNotchScale * 10) / 10
    : null;
  // Use unrounded value for payout computation to match server-side math
  const basePayout = (wager != null && actualMultiplier != null)
    ? Math.round(wager * actualMultiplier * wagerNotchScale)
    : null;
  const qualityBonus = (payout != null && basePayout != null)
    ? payout - basePayout
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
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
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
                  <span className="font-black text-emerald-500">up to {effectiveMultiplier}x</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowTooltip((prev) => !prev);
                    }}
                    className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
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
                  setShowTooltip((prev) => !prev);
                }}
                className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label="View payout breakdown"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </span>
          )}

          {/* Tooltip: payout rates (live) or payout breakdown (resolved) */}
          {showTooltip && (
            <div
              className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-border bg-card p-3 shadow-lg text-[10px] font-normal"
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
                        <span className="text-[11px] text-muted-foreground">Multiplier{hasNotchBonus ? " (w/ difficulty)" : ""}</span>
                        <span className={cn("text-[11px] font-bold", actualEffective > 0 ? "text-emerald-500" : "text-red-400")}>
                          {actualEffective > 0 ? `${actualEffective}x` : "Bust"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Base payout</span>
                      <span className="text-[11px] font-bold text-foreground">{basePayout ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Quality bonus</span>
                      <span className={cn("text-[11px] font-bold", (qualityBonus ?? 0) > 0 ? "text-emerald-500" : (qualityBonus ?? 0) < 0 ? "text-red-400" : "text-muted-foreground")}>
                        {(qualityBonus ?? 0) > 0 ? "+" : ""}{qualityBonus ?? 0}
                      </span>
                    </div>
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
                      <p className="mb-1 font-semibold text-foreground">Difficulty Bonus</p>
                      <div className="flex flex-col gap-0.5">
                        {notchLineItems.map(({ label, cardImpact, isHarder, count }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{label}{count > 1 ? ` ×${count}` : ""}</span>
                            <span className={cn("font-bold", isHarder ? "text-orange-400" : "text-sky-400")}>
                              {cardImpact}x
                            </span>
                          </div>
                        ))}
                        <div className="mt-0.5 flex items-center justify-between border-t border-border/50 pt-0.5">
                          <span className="font-semibold text-foreground">Total</span>
                          <span className="font-bold text-orange-400">{Math.round(wagerNotchScale * 100) / 100}x</span>
                        </div>
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
                      {hasNotchBonus && (
                        <p className="mt-0.5 text-[9px] text-muted-foreground/60">
                          {wager} × {baseMultiplier}x × {Math.round(wagerNotchScale * 100) / 100}x
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </span>
      )}

      <HeatScoreModal open={showHeatInfo} onClose={() => setShowHeatInfo(false)} />
    </span>
  );
}
