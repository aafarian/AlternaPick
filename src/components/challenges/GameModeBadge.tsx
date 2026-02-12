"use client";

import { Badge } from "@/components/ui/badge";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/modes/types";

interface GameModeBadgeProps {
  mode: GameMode;
  size?: "sm" | "md" | "lg";
  /** Show classic mode badge (default: false — hides classic since it's the default) */
  showClassic?: boolean;
}

/**
 * A badge showing the game mode icon and name.
 * Classic mode is hidden by default (opt-in via showClassic).
 */
export default function GameModeBadge({
  mode,
  size = "sm",
  showClassic = false,
}: GameModeBadgeProps) {
  const config = GAME_MODES[mode];
  if (!config) return null;

  if (mode === "classic" && !showClassic) return null;

  const sizeClasses = {
    sm: "gap-1 bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0.5",
    md: "gap-1.5 bg-primary/10 text-primary border-primary/20 text-xs px-2 py-1",
    lg: "gap-2 bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1.5 font-semibold",
  };

  return (
    <Badge variant="secondary" className={sizeClasses[size]}>
      <span>{config.icon}</span>
      <span>{config.displayName}</span>
    </Badge>
  );
}
