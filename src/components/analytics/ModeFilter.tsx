"use client";

import Link from "next/link";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";

interface ModeFilterProps {
  activeMode: string;
  availableModes: GameMode[];
}

export default function ModeFilter({
  activeMode,
  availableModes,
}: ModeFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {/* "All" tab — always shown */}
      <TabLink href="/analytics?mode=all" active={activeMode === "all"}>
        All
      </TabLink>

      {availableModes.map((mode) => {
        const def = GAME_MODES[mode];
        return (
          <TabLink
            key={mode}
            href={`/analytics?mode=${mode}`}
            active={activeMode === mode}
          >
            {def.icon} {def.displayName}
          </TabLink>
        );
      })}
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
      className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
