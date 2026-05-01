"use client";

import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardHeatScoreBadgeProps {
  /** HeatScore stored as multiplier × 100 (e.g., 250 = 2.5x). */
  heatScore?: number | null;
  /** Fire token wager amount. */
  wager?: number | null;
  /** Fire token payout (after resolution). */
  payout?: number | null;
  className?: string;
}

/**
 * Reusable badge for displaying card-level HeatScore + wager/payout.
 * Used in card list (LiveTracker) and card detail (CardDetail).
 */
export default function CardHeatScoreBadge({
  heatScore,
  wager,
  payout,
  className,
}: CardHeatScoreBadgeProps) {
  const hasWager = wager != null;
  const hasPayout = payout != null;
  const hasHS = heatScore != null;

  if (!hasWager && !hasHS) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold tabular-nums", className)}>
      {hasHS && (
        <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[10px] px-1.5 py-0">
          {(heatScore / 100).toFixed(1)}x
        </Badge>
      )}
      {hasWager && (
        <span className="inline-flex items-center gap-0.5 text-orange-400">
          <Flame className="h-3 w-3" />
          <span>-{wager}</span>
          {hasPayout && (
            <span className={payout > 0 ? "text-emerald-500" : "text-red-400"}>
              +{payout}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
