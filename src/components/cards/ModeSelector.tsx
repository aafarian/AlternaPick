"use client";

import type { GameMode } from "@/lib/modes/types";
import { GAME_MODE_LIST } from "@/lib/modes/definitions";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  activeMode: GameMode;
  onSelect: (mode: GameMode) => void;
  disabled?: boolean;
  compact?: boolean;
  /** Filter to only show specific modes (by key). Shows all if omitted. */
  modes?: GameMode[];
}

export default function ModeSelector({
  activeMode,
  onSelect,
  disabled = false,
  compact = false,
  modes,
}: ModeSelectorProps) {
  const modeList = modes
    ? GAME_MODE_LIST.filter((m) => modes.includes(m.key))
    : GAME_MODE_LIST;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {modeList.map((mode) => {
          const isActive = activeMode === mode.key;
          return (
            <button
              key={mode.key}
              onClick={() => onSelect(mode.key)}
              disabled={disabled}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all",
                isActive
                  ? "border-neon-green bg-neon-green/10 text-neon-green"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-50"
              )}
              title={mode.rules}
            >
              <span className="text-sm leading-none">{mode.icon}</span>
              {mode.displayName}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Game Mode
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {modeList.map((mode) => {
          const isActive = activeMode === mode.key;

          return (
            <button
              key={mode.key}
              onClick={() => onSelect(mode.key)}
              disabled={disabled}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all",
                "hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-neon-green bg-neon-green/10 shadow-[0_0_12px_rgba(0,210,106,0.2)]"
                  : "border-border bg-card",
                disabled && "cursor-not-allowed opacity-50"
              )}
              title={mode.rules}
            >
              <span className="text-xl leading-none">{mode.icon}</span>
              <span
                className={cn(
                  "text-xs font-bold leading-tight",
                  isActive ? "text-neon-green" : "text-foreground"
                )}
              >
                {mode.displayName}
              </span>
              <span className="hidden text-[10px] leading-tight text-muted-foreground sm:line-clamp-2">
                {mode.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
