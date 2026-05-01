"use client";

import { useRef } from "react";
import type { StatCategory } from "@/lib/supabase/types";
import { adjustLine, getAvailableNotches, getNotchTier } from "@/lib/heatscore/compute";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tier color mapping
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, { text: string; bg: string }> = {
  blue: { text: "text-blue-400", bg: "bg-blue-400/15" },
  lightblue: { text: "text-sky-400", bg: "bg-sky-400/15" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted" },
  orange: { text: "text-orange-400", bg: "bg-orange-400/15" },
  red: { text: "text-red-400", bg: "bg-red-400/15" },
  purple: { text: "text-purple-400", bg: "bg-purple-400/15" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotchSelectorProps {
  baseLine: number;
  statCategory: StatCategory;
  notch: number;
  onNotchChange: (notch: number, adjustedLine: number) => void;
}

export default function NotchSelector({
  baseLine,
  statCategory,
  notch,
  onNotchChange,
}: NotchSelectorProps) {
  const prefersReduced = useReducedMotion();
  const prevNotchRef = useRef(notch);
  const availableNotches = getAvailableNotches(baseLine, statCategory);
  const currentLine = adjustLine(baseLine, statCategory, notch);
  const tier = getNotchTier(notch);
  const colors = TIER_COLORS[tier.color] ?? TIER_COLORS.neutral;

  const canGoLeft = availableNotches.indexOf(notch) > 0;
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

  // Direction for animation: positive notch change = slide left (new enters from right)
  const slideDirection = notch > prevNotchRef.current ? 1 : -1;
  prevNotchRef.current = notch;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* Line number with arrows */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); shift(-1); }}
          disabled={!canGoLeft}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            canGoLeft
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "cursor-default text-transparent",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="relative flex items-baseline justify-center gap-1.5 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={currentLine}
              className="text-2xl font-black tabular-nums tracking-tight sm:text-3xl"
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
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            canGoRight
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "cursor-default text-transparent",
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tier badge — only shown when shifted */}
      {notch !== 0 && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold",
          colors.bg,
          colors.text,
        )}>
          {tier.label} {tier.multiplier}x
        </span>
      )}
    </div>
  );
}
