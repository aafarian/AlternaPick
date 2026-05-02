"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Flame, HelpCircle } from "lucide-react";
import HeatScoreModal from "@/components/onboarding/HeatScoreModal";
import { getHeatScoreMultiplier } from "@/lib/heatscore/constants";
import { getNotchTier } from "@/lib/heatscore/compute";
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
  className?: string;
}

/**
 * Reusable badge for displaying card-level HeatScore + wager/payout.
 * Shows HeatScore for all cards, wager info only when wagered.
 * Hover reveals a scoring breakdown tooltip.
 */
export default function CardHeatScoreBadge({
  heatScore,
  wager,
  payout,
  cardSize,
  pickNotches,
  className,
}: CardHeatScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showMultiplierTip, setShowMultiplierTip] = useState(false);
  const [showHeatInfo, setShowHeatInfo] = useState(false);
  const hasWager = wager != null;
  const hasHS = heatScore != null;

  const baseMultiplier = cardSize ? getHeatScoreMultiplier(cardSize, cardSize) : null;

  // Compute effective multiplier scaled by average notch difficulty
  const avgNotchMult = pickNotches && pickNotches.length > 0
    ? pickNotches.reduce((sum, n) => sum + getNotchTier(n).multiplier, 0) / pickNotches.length
    : 1;
  const effectiveMultiplier = baseMultiplier != null
    ? Math.round(baseMultiplier * avgNotchMult * 10) / 10
    : null;

  // Build base multiplier rows (raw table values)
  const baseRows = cardSize
    ? Array.from({ length: cardSize + 1 }, (_, i) => cardSize - i).map((hits) => ({
        hits,
        multiplier: getHeatScoreMultiplier(hits, cardSize),
      }))
    : [];

  // Build notch line items: group by tier, show count × multiplier
  const notchLineItems = (() => {
    if (!pickNotches) return [];
    const tierCounts = new Map<number, number>();
    for (const n of pickNotches) {
      tierCounts.set(n, (tierCounts.get(n) ?? 0) + 1);
    }
    // Only show non-standard tiers
    return Array.from(tierCounts.entries())
      .filter(([n]) => n !== 0)
      .sort(([a], [b]) => b - a) // highest notch first
      .map(([notch, count]) => {
        const tier = getNotchTier(notch);
        return { label: tier.label, multiplier: tier.multiplier, count };
      });
  })();

  const hasNotchBonus = notchLineItems.length > 0;

  if (!hasWager && !hasHS) return null;

  return (
    <span
      className={cn("relative inline-flex items-center gap-2 text-[10px] font-bold tabular-nums", className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="group"
      aria-label={`HeatScore: ${heatScore ?? "N/A"}${hasWager ? `, wagered ${wager}` : ""}`}
    >
      {/* HeatScore value (only for non-wagered cards) */}
      {hasHS && !hasWager && (
        <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[10px] px-1.5 py-0 gap-0.5">
          <Flame className="h-2.5 w-2.5" />
          {heatScore}
        </Badge>
      )}

      {/* Wager/payout (only for wagered cards) */}
      {hasWager && (
        <span className="inline-flex items-center gap-1.5 text-xs font-black">
          <Flame className="h-3 w-3 text-orange-400" />
          <span className="text-orange-400">-{wager}</span>
          {payout != null && (
            <span className={payout > 0 ? "text-emerald-500" : "text-muted-foreground"}>
              +{payout}
            </span>
          )}
          {payout == null && effectiveMultiplier != null && effectiveMultiplier > 0 && (
            <span className="relative inline-flex items-center gap-1">
              <span className="text-xs font-black text-orange-400">{effectiveMultiplier}x</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowMultiplierTip((prev) => !prev);
                }}
                className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                aria-label="View payout multipliers"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
              {showMultiplierTip && (
                <div
                  className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-md border border-border bg-card p-2.5 shadow-lg text-[10px] font-normal"
                  onMouseLeave={() => setShowMultiplierTip(false)}
                >
                  {/* Base payout table */}
                  <p className="mb-1.5 font-semibold text-foreground">Base Payout</p>
                  <div className="flex flex-col gap-0.5">
                    {baseRows.map(({ hits, multiplier }) => (
                      <div key={hits} className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {hits}/{cardSize} picks
                        </span>
                        <span className={cn(
                          "font-bold",
                          multiplier > 0 ? "text-emerald-500" : "text-red-400",
                        )}>
                          {multiplier > 0 ? `${multiplier}x` : "Bust"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Notch difficulty line items */}
                  {hasNotchBonus && (
                    <>
                      <div className="my-1.5 border-t border-border" />
                      <p className="mb-1 font-semibold text-foreground">Difficulty Bonus</p>
                      <div className="flex flex-col gap-0.5">
                        {notchLineItems.map(({ label, multiplier, count }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {label} line{count > 1 ? ` ×${count}` : ""}
                            </span>
                            <span className={cn(
                              "font-bold",
                              multiplier > 1 ? "text-orange-400" : "text-sky-400",
                            )}>
                              {multiplier}x
                            </span>
                          </div>
                        ))}
                        <div className="mt-0.5 flex items-center justify-between border-t border-border/50 pt-0.5">
                          <span className="font-semibold text-foreground">Total</span>
                          <span className="font-bold text-orange-400">
                            {Math.round(avgNotchMult * 100) / 100}x
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Grand total */}
                  {wager != null && baseMultiplier != null && (
                    <>
                      <div className="my-1.5 border-t border-border" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Max payout</span>
                        <span className="font-black text-emerald-500">
                          {Math.round(wager * (effectiveMultiplier ?? baseMultiplier)).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/60">
                        {wager} × {baseMultiplier}x{hasNotchBonus ? ` × ${Math.round(avgNotchMult * 100) / 100}x` : ""}
                      </p>
                    </>
                  )}
                </div>
              )}
            </span>
          )}
        </span>
      )}

      {/* Scoring tooltip */}
      {showTooltip && hasHS && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card p-2 shadow-lg text-[10px] font-normal">
          <p className="font-semibold text-foreground mb-1">HeatScore Breakdown</p>
          <p className="text-muted-foreground">
            Each hit: +130 × notch multiplier
          </p>
          <p className="text-muted-foreground">
            Quality bonus from margins
          </p>
          {hasWager && payout != null && (
            <>
              <div className="border-t border-border my-1" />
              <p className="text-muted-foreground">
                Wagered: {wager} · Payout: {payout}
              </p>
              <p className={cn(
                "font-semibold",
                payout > wager ? "text-emerald-500" : payout < wager ? "text-red-400" : "text-muted-foreground",
              )}>
                Net: {payout - wager >= 0 ? "+" : ""}{payout - wager}
              </p>
            </>
          )}
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

      <HeatScoreModal open={showHeatInfo} onClose={() => setShowHeatInfo(false)} />
    </span>
  );
}
