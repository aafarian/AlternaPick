/**
 * Barrel export for motion (motion.dev) animation library.
 *
 * All motion imports across the codebase should come from this file
 * (`@/lib/motion`) so a future library swap only requires changes here.
 *
 * Every component that uses these exports must be a client component
 * (`"use client"`) because motion relies on browser APIs.
 */

export {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
