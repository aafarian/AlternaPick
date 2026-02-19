"use client";

import type { Achievement, UserAchievement } from "@/lib/supabase/types";
import { Lock } from "lucide-react";
import { motion, useReducedMotion } from "@/lib/motion";

interface BadgeCardProps {
  achievement: Achievement;
  userAchievement: UserAchievement | null;
}

export default function BadgeCard({
  achievement,
  userAchievement,
}: BadgeCardProps) {
  const isUnlocked = !!userAchievement;
  const prefersReduced = useReducedMotion();
  const isLegendary = achievement.tier === "legendary" && isUnlocked;

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

  const legendaryGlowClass = isLegendary
    ? "legendary-badge-glow"
    : "";

  const legendaryGlowStyle = isLegendary && !prefersReduced
    ? { animation: "legendary-badge-glow 3s ease-in-out infinite" }
    : undefined;

  // Hover scale for unlocked badges only
  const hoverProps = isUnlocked && !prefersReduced
    ? {
        whileHover: {
          scale: 1.03,
          boxShadow: isLegendary
            ? "0 0 20px rgba(168, 85, 247, 0.2)"
            : "0 4px 12px rgba(0, 0, 0, 0.1)",
        },
        transition: { type: "spring" as const, stiffness: 400, damping: 25 },
      }
    : {};

  return (
    <motion.div
      className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${tierBorderClass} ${legendaryGlowClass} ${
        isUnlocked
          ? "bg-card shadow-sm"
          : "bg-card/50 opacity-50 grayscale"
      }`}
      style={legendaryGlowStyle}
      {...hoverProps}
    >
      {/* Icon with pop-in effect */}
      <div className="relative">
        <motion.span
          className="text-3xl leading-none inline-block"
          role="img"
          aria-label={achievement.name}
          initial={prefersReduced ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        >
          {achievement.icon}
        </motion.span>
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

      {/* Unlock date — always reserve space so all cards share the same height */}
      {isUnlocked && unlockDate ? (
        <span className="mt-auto text-[10px] font-medium text-primary">
          Unlocked {unlockDate}
        </span>
      ) : (
        <span className="mt-auto text-[10px] invisible" aria-hidden="true">
          Placeholder
        </span>
      )}
    </motion.div>
  );
}
