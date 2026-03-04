import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";

/**
 * Return the display name for a game mode (e.g. "Classic", "Sabotage").
 */
export function modeLabel(mode: GameMode): string {
  return GAME_MODES[mode]?.displayName ?? mode;
}

/**
 * Return the emoji icon for a game mode.
 */
export function modeIcon(mode: GameMode): string {
  return GAME_MODES[mode]?.icon ?? "";
}

/**
 * Return combined "icon name" string for a mode badge.
 */
export function modeBadgeText(mode: GameMode): string {
  const icon = modeIcon(mode);
  const label = modeLabel(mode);
  return icon ? `${icon} ${label}` : label;
}
