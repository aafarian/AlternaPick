"use client";

import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";

interface ModeFilterProps {
  activeMode: string;
  availableModes: GameMode[];
  onSelect: (mode: GameMode | "all") => void;
}

export default function ModeFilter({
  activeMode,
  availableModes,
  onSelect,
}: ModeFilterProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent" />
      <div className="flex items-center gap-0.5 overflow-x-auto pr-6 scrollbar-none">
        <TabButton active={activeMode === "all"} onClick={() => onSelect("all")}>
          All
        </TabButton>
        {availableModes.map((mode) => {
          const def = GAME_MODES[mode];
          return (
            <TabButton
              key={mode}
              active={activeMode === mode}
              onClick={() => onSelect(mode)}
            >
              {def.displayName}
            </TabButton>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
      )}
    </button>
  );
}
