"use client";

import { useReducedMotion } from "@/lib/motion";

/**
 * Shared hover-lift animation props for challenge cards.
 * Returns motion `hoverProps` to spread on a `motion.div`, plus `prefersReduced`.
 */
export function useCardHover(
  liftPx = -1,
  shadow = "0 4px 12px rgba(0, 0, 0, 0.15)"
) {
  const prefersReduced = useReducedMotion();
  const hoverProps = prefersReduced
    ? {}
    : {
        whileHover: { y: liftPx, boxShadow: shadow },
        transition: {
          type: "spring" as const,
          stiffness: 400,
          damping: 30,
        },
      };
  return { hoverProps, prefersReduced };
}
