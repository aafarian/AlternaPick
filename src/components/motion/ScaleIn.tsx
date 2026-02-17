"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "@/lib/motion";

interface ScaleInProps {
  delay?: number;
  duration?: number;
  initialScale?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Animates children from a scaled-down + transparent state to full size + opaque.
 * Used for elements that should "pop" into view (hero badges, CTA buttons, etc.).
 *
 * Respects `prefers-reduced-motion` — renders children immediately with no animation.
 */
export function ScaleIn({
  delay = 0,
  duration = 0.5,
  initialScale = 0.9,
  className,
  children,
}: ScaleInProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ scale: initialScale, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
