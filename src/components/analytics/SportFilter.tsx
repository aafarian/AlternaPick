"use client";

import Link from "next/link";
import { UI_SPORTS, SPORT_CONFIG } from "@/lib/sports";

interface SportFilterProps {
  activeSport: string;
  currentMode: string;
}

export default function SportFilter({
  activeSport,
  currentMode,
}: SportFilterProps) {
  const modeParam = currentMode && currentMode !== "all" ? `&mode=${currentMode}` : "";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent" />
      <div className="flex items-center gap-1 overflow-x-auto pr-6 scrollbar-none">
        <TabPill
          href={`/analytics?sport=all${modeParam}`}
          active={activeSport === "all"}
        >
          All Sports
        </TabPill>
        {UI_SPORTS.map((key) => {
          const sport = SPORT_CONFIG[key];
          return (
            <TabPill
              key={key}
              href={`/analytics?sport=${key}${modeParam}`}
              active={activeSport === key}
            >
              {sport.shortLabel}
            </TabPill>
          );
        })}
      </div>
    </div>
  );
}

function TabPill({
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
      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
