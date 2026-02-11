import type { Achievement, UserAchievement } from "@/lib/supabase/types";
import { Lock } from "lucide-react";

interface BadgeCardProps {
  achievement: Achievement;
  userAchievement: UserAchievement | null;
}

export default function BadgeCard({
  achievement,
  userAchievement,
}: BadgeCardProps) {
  const isUnlocked = !!userAchievement;

  const unlockDate = userAchievement
    ? new Date(userAchievement.unlocked_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const tierColorMap: Record<string, string> = {
    standard: "border-border",
    gold: "border-yellow-500/60",
    legendary: "border-purple-500/60",
  };

  const tierBorderClass = isUnlocked
    ? tierColorMap[achievement.tier] ?? "border-primary/40"
    : "border-border";

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${tierBorderClass} ${
        isUnlocked
          ? "bg-card shadow-sm"
          : "bg-card/50 opacity-50 grayscale"
      }`}
    >
      {/* Icon */}
      <div className="relative">
        <span className="text-3xl leading-none" role="img" aria-label={achievement.name}>
          {achievement.icon}
        </span>
        {!isUnlocked && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-muted p-0.5">
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Name */}
      <h4 className="text-xs font-semibold leading-tight">{achievement.name}</h4>

      {/* Description / Unlock info */}
      <p className="text-[10px] leading-snug text-muted-foreground">
        {achievement.description}
      </p>

      {/* Unlock date */}
      {isUnlocked && unlockDate && (
        <span className="mt-auto text-[10px] font-medium text-primary">
          Unlocked {unlockDate}
        </span>
      )}
    </div>
  );
}
