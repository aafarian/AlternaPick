"use client";

import { useRef } from "react";
import type { StatCategory } from "@/lib/supabase/types";
import { adjustLine, getAvailableNotches, getNotchTier } from "@/lib/heatscore/compute";
import type { NotchTier } from "@/lib/heatscore/constants";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tier color mapping — exported for use by PropLine's badge
// ---------------------------------------------------------------------------

export const TIER_COLORS: Record<string, { text: string; bg: string; border: string; numberTint: string }> = {
  blue: { text: "text-blue-400", bg: "bg-blue-400/15", border: "border-blue-400/30", numberTint: "text-blue-300/80" },
  lightblue: { text: "text-sky-400", bg: "bg-sky-400/15", border: "border-sky-400/30", numberTint: "text-sky-300/80" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted", border: "border-border", numberTint: "" },
  yellow: { text: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400/30", numberTint: "text-yellow-300/70" },
  orange: { text: "text-orange-400", bg: "bg-orange-400/15", border: "border-orange-400/30", numberTint: "text-orange-300/70" },
  red: { text: "text-red-400", bg: "bg-red-400/15", border: "border-red-400/30", numberTint: "text-red-300/70" },
};

export { getNotchTier };
export type { NotchTier };

/** Get the number tint class for a notch value. Returns undefined for Standard. */
export function notchNumberTint(notch?: number): string | undefined {
  if (notch == null || notch === 0) return undefined;
  return TIER_COLORS[getNotchTier(notch).color]?.numberTint;
}

// ---------------------------------------------------------------------------
// Component — just the line number with left/right arrows
// ---------------------------------------------------------------------------

interface NotchSelectorProps {
  baseLine: number;
  statCategory: StatCategory;
  notch: number;
  onNotchChange: (notch: number, adjustedLine: number) => void;
  /** Whether shifting to easy (negative) notches is allowed. */
  canGoEasy?: boolean;
}

export default function NotchSelector({
  baseLine,
  statCategory,
  notch,
  onNotchChange,
  canGoEasy = true,
}: NotchSelectorProps) {
  const prefersReduced = useReducedMotion();
  const prevNotchRef = useRef(notch);
  const availableNotches = getAvailableNotches(baseLine, statCategory);
  const currentLine = adjustLine(baseLine, statCategory, notch);

  const tier = getNotchTier(notch);
  const colors = TIER_COLORS[tier.color] ?? TIER_COLORS.neutral;

  const nextLeftNotch = availableNotches[availableNotches.indexOf(notch) - 1];
  const canGoLeft = availableNotches.indexOf(notch) > 0 && (nextLeftNotch >= 0 || canGoEasy);
  const canGoRight = availableNotches.indexOf(notch) < availableNotches.length - 1;

  function shift(direction: -1 | 1) {
    const idx = availableNotches.indexOf(notch);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= availableNotches.length) return;
    const nextNotch = availableNotches[nextIdx];
    const nextLine = adjustLine(baseLine, statCategory, nextNotch);
    prevNotchRef.current = notch;
    onNotchChange(nextNotch, nextLine);
  }

  const slideDirection = notch > prevNotchRef.current ? 1 : -1;
  prevNotchRef.current = notch;

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); shift(-1); }}
        disabled={!canGoLeft}
        aria-label="Easier line"
        className={cn(
          "flex h-6 w-5 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-7",
          canGoLeft
            ? "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
            : "pointer-events-none text-transparent",
        )}
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <div className="relative flex min-w-[2.75rem] items-baseline justify-center overflow-hidden sm:min-w-[4rem]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={currentLine}
            className={cn(
              "text-xl font-black tabular-nums tracking-tight sm:text-3xl",
              notch !== 0 && colors.numberTint,
            )}
            {...(prefersReduced
              ? {}
              : {
                  initial: { x: slideDirection * 20, opacity: 0 },
                  animate: { x: 0, opacity: 1 },
                  exit: { x: slideDirection * -20, opacity: 0 },
                  transition: { duration: 0.15, ease: "easeOut" },
                })}
          >
            {currentLine}
          </motion.span>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); shift(1); }}
        disabled={!canGoRight}
        aria-label="Harder line"
        className={cn(
          "flex h-6 w-5 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-7",
          canGoRight
            ? "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
            : "pointer-events-none text-transparent",
        )}
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </div>
  );
}
