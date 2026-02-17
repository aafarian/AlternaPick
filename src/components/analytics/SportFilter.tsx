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
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <TabLink
        href={`/analytics?sport=all${modeParam}`}
        active={activeSport === "all"}
      >
        All Sports
      </TabLink>

      {UI_SPORTS.map((key) => {
        const sport = SPORT_CONFIG[key];
        return (
          <TabLink
            key={key}
            href={`/analytics?sport=${key}${modeParam}`}
            active={activeSport === key}
          >
            {sport.icon} {sport.displayName}
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
