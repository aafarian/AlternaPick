"use client";

import { Children, type ReactNode, type ReactElement, isValidElement } from "react";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

type AnimationType = "slideUp" | "fadeIn" | "scaleIn";

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds between each child animation (default 0.06). */
  staggerDelay?: number;
  /** Which entrance animation to apply to each item (default "slideUp"). */
  animationType?: AnimationType;
}

const animationVariants: Record<
  AnimationType,
  { hidden: Record<string, number>; visible: Record<string, number>; exit: Record<string, number> }
> = {
  slideUp: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
};

const reducedVariants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Wraps a dynamic list of items with staggered entrance/exit animations.
 *
 * Unlike `StaggerChildren` (which animates only on mount), `AnimatedList`
 * uses `AnimatePresence` so items animate in when added and out when removed,
 * making it ideal for data that loads asynchronously or changes over time
 * (e.g. friend-request lists, challenge feeds).
 *
 * Each child must have a stable `key` prop so AnimatePresence can track
 * additions and removals correctly.
 *
 * Respects `prefers-reduced-motion` — renders children immediately with no animation.
 */
export function AnimatedList({
  children,
  className,
  staggerDelay = 0.06,
  animationType = "slideUp",
}: AnimatedListProps) {
  const prefersReduced = useReducedMotion();
  const variants = prefersReduced ? reducedVariants : animationVariants[animationType];

  const childArray = Children.toArray(children).filter(isValidElement) as ReactElement[];

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {childArray.map((child, index) => (
          <motion.div
            key={child.key}
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={
              prefersReduced
                ? { duration: 0 }
                : { duration: 0.35, ease: "easeOut", delay: index * staggerDelay }
            }
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
