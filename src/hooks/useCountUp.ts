"use client";

import { useEffect, useRef, useState } from "react";

/**
 * easeOutCubic — fast start, natural deceleration.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates an integer from 0 to `target` over `duration` ms using
 * requestAnimationFrame with easeOutCubic easing.
 *
 * Respects `prefers-reduced-motion` — instantly returns `target` when active.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect reduced-motion preference
    const mql =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    if (mql?.matches) {
      setValue(target);
      return;
    }

    // Reset to 0 when target changes, then animate
    setValue(0);

    if (target === 0) return;

    let startTime: number | null = null;

    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      setValue(Math.round(easedProgress * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return value;
}
