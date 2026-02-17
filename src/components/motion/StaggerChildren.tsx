"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "@/lib/motion";

/**
 * Orchestrates staggered entrance animations for child elements.
 *
 * The parent `motion.div` drives timing via the `staggerChildren` transition
 * property. Each direct child wrapped in `<StaggerItem>` inherits `hidden`
 * and `visible` variants so items fade-in and slide-up one after another.
 *
 * When `prefers-reduced-motion` is active all children render instantly with
 * no animation.
 */

const parentVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: {
      staggerChildren: staggerDelay,
    },
  }),
};

const childVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const reducedParentVariants = {
  hidden: {},
  visible: {},
};

const reducedChildVariants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

interface StaggerChildrenProps {
  /** Delay in seconds between each child animation (default 0.1). */
  staggerDelay?: number;
  className?: string;
  children: ReactNode;
}

export function StaggerChildren({
  staggerDelay = 0.1,
  className,
  children,
}: StaggerChildrenProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={prefersReduced ? reducedParentVariants : parentVariants}
      custom={staggerDelay}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * Wrap each direct child of `<StaggerChildren>` in this component so it
 * inherits the stagger timing and animates with fade + slide-up.
 */
export function StaggerItem({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={prefersReduced ? reducedChildVariants : childVariants}
    >
      {children}
    </motion.div>
  );
}
