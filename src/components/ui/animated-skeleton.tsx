"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Skeleton shape presets keyed by variant.
 * Each variant provides a default Tailwind class string that determines
 * the skeleton's height, width, and border-radius.
 */
const variantClasses: Record<string, string> = {
  card: "h-28 w-full rounded-xl",
  row: "h-4 w-full rounded-md",
  avatar: "h-10 w-10 rounded-full",
  text: "h-3 w-3/4 rounded-md",
};

const parentVariants = {
  hidden: {},
  visible: (staggerDelay: number) => ({
    transition: { staggerChildren: staggerDelay },
  }),
};

const childVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
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

interface AnimatedSkeletonProps {
  /** Number of skeleton rows to render (default 3). */
  count?: number;
  /** Tailwind classes applied to each skeleton row. */
  className?: string;
  /** Shape preset: card, row, avatar, or text (default "row"). */
  variant?: "card" | "row" | "avatar" | "text";
  /** Tailwind classes applied to the outer container. */
  containerClassName?: string;
  children?: ReactNode;
}

/**
 * A loading skeleton with staggered entrance animation and a CSS shimmer
 * sweep. Renders `count` skeleton rows using the selected `variant` shape.
 *
 * The shimmer effect uses a pure-CSS gradient animation (`skeleton-shimmer`)
 * and automatically disables for users who prefer reduced motion.
 *
 * When reduced motion is preferred, skeletons render instantly with no
 * animation and a static background.
 */
export function AnimatedSkeleton({
  count = 3,
  className,
  variant = "row",
  containerClassName,
}: AnimatedSkeletonProps) {
  const prefersReduced = useReducedMotion();
  const shape = variantClasses[variant] ?? variantClasses.row;

  if (prefersReduced) {
    return (
      <div className={cn("flex flex-col gap-3", containerClassName)}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={cn("bg-muted rounded-md", shape, className)}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("flex flex-col gap-3", containerClassName)}
      variants={prefersReduced ? reducedParentVariants : parentVariants}
      custom={0.04}
      initial="hidden"
      animate="visible"
    >
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          variants={prefersReduced ? reducedChildVariants : childVariants}
          className={cn(
            "relative overflow-hidden bg-muted rounded-md",
            shape,
            className,
          )}
        >
          {/* Shimmer overlay */}
          <div className="animate-skeleton-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </motion.div>
      ))}
    </motion.div>
  );
}
