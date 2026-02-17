"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "@/lib/motion";

export interface ScrollRevealProps {
  /** Fraction of element that must be visible to trigger (0-1). Default 0.2 */
  threshold?: number;
  /** If true, animation plays only the first time the element enters view. Default true */
  once?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Scroll-triggered reveal wrapper.
 *
 * Children fade in and slide up when the element enters the viewport.
 * When `prefers-reduced-motion` is active the children render immediately
 * with no animation.
 */
export function ScrollReveal({
  threshold = 0.2,
  once = true,
  className,
  children,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: threshold, once });
  const prefersReduced = useReducedMotion();

  // When reduced motion is preferred, skip the animation entirely.
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
