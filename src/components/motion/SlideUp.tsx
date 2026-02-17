"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "@/lib/motion";

interface SlideUpProps {
  delay?: number;
  duration?: number;
  /** How far below (in pixels) the element starts before sliding up. Default 24. */
  offset?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Animates children from below (translateY + transparent) to their natural
 * position (translateY(0) + fully opaque). Primary entrance animation for
 * content sections and landing-page reveals.
 *
 * Respects `prefers-reduced-motion` — renders children immediately with no animation.
 */
export function SlideUp({
  delay = 0,
  duration = 0.5,
  offset = 24,
  className,
  children,
}: SlideUpProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ y: offset, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
