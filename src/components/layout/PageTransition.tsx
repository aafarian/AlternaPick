"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

/**
 * Wraps page content with a subtle fade + slide transition on route changes.
 *
 * Uses `AnimatePresence` keyed on the current pathname so that navigating
 * between routes triggers a quick exit → enter animation cycle.
 *
 * Exit: 150 ms fade-out.
 * Enter: 200 ms fade-in with a slight 8 px slide-up.
 *
 * When `prefers-reduced-motion` is active the animation is skipped entirely.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
