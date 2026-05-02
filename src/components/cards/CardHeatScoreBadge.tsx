"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardHeatScoreBadgeProps {
  /** Raw HeatScore value (per-pick additive). */
  heatScore?: number | null;
  /** Flame token wager amount. */
  wager?: number | null;
  /** Flame token payout (after resolution). */
  payout?: number | null;
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
  className,
}: CardHeatScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hasWager = wager != null;
  const hasHS = heatScore != null;

  if (!hasWager && !hasHS) return null;

  return (
    <span
      className={cn("relative inline-flex items-center gap-1.5 text-[10px] font-bold tabular-nums", className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* HeatScore value (always shown when available) */}
      {hasHS && (
        <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[10px] px-1.5 py-0 gap-0.5">
          <Flame className="h-2.5 w-2.5" />
          {heatScore}
        </Badge>
      )}

      {/* Wager/payout (only for wagered cards) */}
      {hasWager && (
        <span className="inline-flex items-center gap-0.5 text-orange-400">
          <span>-{wager}</span>
          {payout != null && (
            <span className={payout > 0 ? "text-emerald-500" : "text-red-400"}>
              +{payout}
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
        </div>
      )}
    </span>
  );
}
