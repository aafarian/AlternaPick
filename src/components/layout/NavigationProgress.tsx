"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNavClickDetection } from "@/hooks/useNavClickDetection";

/**
 * Thin progress bar at the top of the viewport that shows during page
 * navigations. Detects navigation start via useNavClickDetection, and
 * clears when usePathname() updates (meaning the route resolved).
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const hideRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Navigation complete — animate to 100% then hide
  useEffect(() => {
    if (!navigating) return;
    clearInterval(timerRef.current);
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setNavigating(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(hideRef.current);
    // Only fire when pathname changes, not when navigating changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useNavClickDetection(() => {
    setNavigating(true);
    setProgress(15);
  });

  // Gradually increase progress to simulate loading
  useEffect(() => {
    if (!navigating || progress >= 90) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + (90 - prev) * 0.08;
      });
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [navigating, progress]);

  if (!navigating && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          transition:
            progress >= 100
              ? "width 200ms ease-out, opacity 200ms ease-out 100ms"
              : "width 200ms ease-out",
        }}
      />
    </div>
  );
}
