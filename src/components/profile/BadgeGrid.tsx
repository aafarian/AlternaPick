"use client";

import type { Achievement, UserAchievement } from "@/lib/supabase/types";
import BadgeCard from "./BadgeCard";

interface BadgeGridProps {
  achievements: Achievement[];
  unlocked: UserAchievement[];
}

export default function BadgeGrid({ achievements, unlocked }: BadgeGridProps) {
  const unlockedMap = new Map(
    unlocked.map((ua) => [ua.achievement_id, ua])
  );

  const unlockedCount = unlocked.length;
  const totalCount = achievements.length;

  if (totalCount === 0) {
    return null;
  }

  // Sort: unlocked first, then by tier weight
  const tierWeight: Record<string, number> = {
    legendary: 0,
    gold: 1,
    standard: 2,
  };

  const sorted = [...achievements].sort((a, b) => {
    const aUnlocked = unlockedMap.has(a.id) ? 0 : 1;
    const bUnlocked = unlockedMap.has(b.id) ? 0 : 1;
    if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;
    return (tierWeight[a.tier] ?? 3) - (tierWeight[b.tier] ?? 3);
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Achievements</h2>
        <span className="text-sm text-muted-foreground">
          {unlockedCount}/{totalCount} Badges Unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((achievement) => (
          <BadgeCard
            key={achievement.id}
            achievement={achievement}
            userAchievement={unlockedMap.get(achievement.id) ?? null}
          />
        ))}
      </div>
    </section>
  );
}
