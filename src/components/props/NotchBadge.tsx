"use client";

import { getNotchTier } from "@/lib/heatscore/compute";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Per-tier colors: text, bar fill
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<number, { text: string; bar: string }> = {
  [-2]: { text: "text-blue-400", bar: "bg-blue-400" },       // Frosty
  [-1]: { text: "text-sky-400", bar: "bg-sky-400" },          // Chilled
  [1]: { text: "text-yellow-400", bar: "bg-yellow-400" },     // Heated
  [2]: { text: "text-orange-400", bar: "bg-orange-400" },     // Scorched
  [3]: { text: "text-red-400", bar: "bg-red-400" },           // Volcanic
};

const EMPTY_BAR = "bg-muted-foreground/20";

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
 * Positive notches: Heated (1 yellow), Scorched (2 orange), Volcanic (3 red).
 * Negative notches: Chilled (1 blue), Frosty (2 blue).
 * Standard (0): not rendered.
 */
export default function NotchBadge({ notch, className }: NotchBadgeProps) {
  if (notch === 0) return null;

  const tier = getNotchTier(notch);
  const styles = TIER_STYLES[notch] ?? { text: "text-muted-foreground", bar: EMPTY_BAR };
  const isHot = notch > 0;
  const bars = Math.abs(notch);
  const maxBars = isHot ? 3 : 2;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn("text-[9px] font-bold", styles.text)}>
        {tier.label}
      </span>
      <span className="inline-flex items-center gap-px">
        {Array.from({ length: maxBars }, (_, i) => (
          <span
            key={i}
            className={cn(
              "inline-block h-2 w-1 rounded-[1px]",
              i < bars ? styles.bar : EMPTY_BAR,
            )}
          />
        ))}
      </span>
    </span>
  );
}
