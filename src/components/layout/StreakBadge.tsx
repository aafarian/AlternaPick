"use client";

import { useState, useEffect } from "react";

interface StreakData {
  daily_streak: number;
  best_daily_streak: number;
  freezes_available: number;
  next_freeze_reset: string | null;
}

/**
 * Compact streak badge for the header.
 * Fetches streak data on mount and displays fire emoji + streak count.
 * Hidden when streak is 0. Tooltip shows full streak details.
 */
export default function StreakBadge() {
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStreak() {
      try {
        const res = await fetch("/api/streaks");
        if (!res.ok) return;
        const data: StreakData = await res.json();
        if (!cancelled) setStreak(data);
      } catch {
        // Silently ignore fetch errors
      }
    }

    fetchStreak();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide when no streak data or streak is 0
  if (!streak || streak.daily_streak <= 0) return null;

  const tooltipText = `Daily Streak: ${streak.daily_streak} | Best: ${streak.best_daily_streak} | Freezes: ${streak.freezes_available}`;

  return (
    <div
      title={tooltipText}
      className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 cursor-default select-none"
      role="status"
      aria-label={`${streak.daily_streak} day streak`}
    >
      <span className="text-base leading-none" aria-hidden="true">
        🔥
      </span>
      <span>{streak.daily_streak}</span>
    </div>
  );
}
