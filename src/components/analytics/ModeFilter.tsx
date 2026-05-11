"use client";

import Link from "next/link";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";

interface ModeFilterProps {
  activeMode: string;
  availableModes: GameMode[];
  currentSport: string;
}

export default function ModeFilter({
  activeMode,
  availableModes,
  currentSport,
}: ModeFilterProps) {
  const sportParam = currentSport && currentSport !== "all" ? `&sport=${currentSport}` : "";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent" />
      <div className="flex items-center gap-0.5 overflow-x-auto pr-6 scrollbar-none">
        <TabLink href={`/analytics?mode=all${sportParam}`} active={activeMode === "all"}>
          All
        </TabLink>
        {availableModes.map((mode) => {
          const def = GAME_MODES[mode];
          return (
            <TabLink
              key={mode}
              href={`/analytics?mode=${mode}${sportParam}`}
              active={activeMode === mode}
            >
              {def.displayName}
            </TabLink>
          );
        })}
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
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
    </Link>
  );
}
