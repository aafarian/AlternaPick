"use client";

import { useCountUp } from "@/hooks/useCountUp";

interface AnimatedNumberProps {
  /** The target number to count up to. */
  value: number;
  /** Optional suffix appended after the number (e.g. "%"). */
  suffix?: string;
  /** Animation duration in ms (default 800). */
  duration?: number;
}

/**
 * Displays a number that counts up from 0 to `value` with easeOutCubic
 * easing. Formatted with locale-aware thousands separators.
 *
 * Respects `prefers-reduced-motion` via the underlying hook.
 */
export function AnimatedNumber({
  value,
  suffix,
  duration,
}: AnimatedNumberProps) {
  const animated = useCountUp(value, duration);
  return (
    <>
      {animated.toLocaleString()}
      {suffix}
    </>
  );
}
