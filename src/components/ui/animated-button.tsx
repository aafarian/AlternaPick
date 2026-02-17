"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";
import { Loader2 } from "lucide-react";

const hoverSpring = { type: "spring" as const, stiffness: 400, damping: 25 };

/**
 * Props that conflict between React's native button events and motion's event
 * handlers (e.g. `onDrag`). We omit them from React's type so the rest-spread
 * doesn't cause a TS error when applied to `motion.button`.
 */
type MotionConflictingProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd";

interface AnimatedButtonProps
  extends Omit<React.ComponentProps<"button">, MotionConflictingProps>,
    VariantProps<typeof buttonVariants> {
  /** When true, shows a spinner and optionally replaces text with `loadingText`. */
  loading?: boolean;
  /** Text shown next to the spinner while `loading` is true. */
  loadingText?: string;
}

/**
 * A drop-in replacement for `<Button>` with micro-interaction animations:
 *
 * - **Hover**: subtle 1.02x scale via spring transition
 * - **Press / active**: 0.97x scale via fast spring
 * - **Primary variant hover**: pulsing neon-green glow (box-shadow)
 * - **Loading state**: smooth content swap with spinner via AnimatePresence
 *
 * All animations are disabled when `prefers-reduced-motion` is active.
 */
function AnimatedButton({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: AnimatedButtonProps) {
  const prefersReduced = useReducedMotion();
  const isDisabled = disabled || loading;

  /* Glow class — only for the default (primary) variant */
  const isPrimary = variant === "default" || variant === undefined;

  /* Combine variant classes */
  const classes = cn(
    buttonVariants({ variant, size }),
    isPrimary && !prefersReduced && "animated-btn-glow",
    className,
  );

  /* ---- Reduced-motion fallback: plain <button> with no motion wrapper ---- */
  if (prefersReduced) {
    return (
      <button
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {loadingText ?? children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }

  /* ---- Full animated version ---- */
  return (
    <motion.button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classes}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={hoverSpring}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span
            key="loading"
            className="inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <Loader2 className="size-4 animate-spin" />
            {loadingText ?? children}
          </motion.span>
        ) : (
          <motion.span
            key="content"
            className="inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export { AnimatedButton, type AnimatedButtonProps };
