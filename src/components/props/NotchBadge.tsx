"use client";

import { getNotchTier } from "@/lib/heatscore/compute";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Battery-bar colors for positive (hot) and negative (cold) tiers
// ---------------------------------------------------------------------------

const HOT_BAR = "bg-red-400";
const COLD_BAR = "bg-blue-400";
const EMPTY_BAR = "bg-muted-foreground/20";

const TIER_TEXT_COLORS: Record<string, string> = {
  blue: "text-blue-400",
  lightblue: "text-sky-400",
  neutral: "text-muted-foreground",
  orange: "text-orange-400",
  red: "text-red-400",
  purple: "text-purple-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotchBadgeProps {
  notch: number;
  className?: string;
}

/**
 * Compact notch tier indicator with label + battery bars.
 *
 * Positive notches (Heated/Scorched/Volcanic): 1-3 red bars filled.
 * Negative notches (Chilled/Frosty): 1-2 blue bars filled.
 * Standard (0): not rendered.
 */
export default function NotchBadge({ notch, className }: NotchBadgeProps) {
  if (notch === 0) return null;

  const tier = getNotchTier(notch);
  const textColor = TIER_TEXT_COLORS[tier.color] ?? TIER_TEXT_COLORS.neutral;
  const isHot = notch > 0;
  const bars = Math.abs(notch);
  const maxBars = isHot ? 3 : 2;
  const fillColor = isHot ? HOT_BAR : COLD_BAR;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn("text-[9px] font-bold", textColor)}>
        {tier.label}
      </span>
      <span className="inline-flex items-center gap-px">
        {Array.from({ length: maxBars }, (_, i) => (
          <span
            key={i}
            className={cn(
              "inline-block h-2 w-1 rounded-[1px]",
              i < bars ? fillColor : EMPTY_BAR,
            )}
          />
        ))}
      </span>
    </span>
  );
}
