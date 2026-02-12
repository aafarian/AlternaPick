"use client";

import { Badge } from "@/components/ui/badge";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/modes/types";

interface GameModeBadgeProps {
  mode: GameMode;
  /** Compact: only icon + name. Full: adds description below. */
  size?: "sm" | "md";
}

/**
 * A badge showing the game mode icon and name.
 * Classic mode is omitted by default since it's the default mode.
 */
export default function GameModeBadge({ mode, size = "sm" }: GameModeBadgeProps) {
  const config = GAME_MODES[mode];
  if (!config) return null;

  // Don't show badge for classic mode (it's the default)
  if (mode === "classic") return null;

  return (
    <Badge
      variant="secondary"
      className={
        size === "sm"
          ? "gap-1 bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0.5"
          : "gap-1.5 bg-primary/10 text-primary border-primary/20 text-xs px-2 py-1"
      }
    >
      <span>{config.icon}</span>
      <span>{config.displayName}</span>
    </Badge>
  );
}
