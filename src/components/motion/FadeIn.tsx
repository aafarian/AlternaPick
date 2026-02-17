"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "@/lib/motion";

interface FadeInProps {
  delay?: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Animates children from transparent to fully opaque on mount.
 * The most basic animation primitive — useful for gently revealing
 * any content (headings, cards, sections, etc.).
 *
 * Respects `prefers-reduced-motion` — renders children immediately with no animation.
 */
export function FadeIn({
  delay = 0,
  duration = 0.5,
  className,
  children,
}: FadeInProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
