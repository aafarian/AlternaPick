"use client";

import { motion } from "motion/react";
import { UI_SPORTS, SPORT_CONFIG } from "@/lib/sports";
import type { SportKey } from "@/lib/sports";

interface SportFilterProps {
  activeSport: string;
  onSelect: (sport: SportKey | "all") => void;
}

export default function SportFilter({
  activeSport,
  onSelect,
}: SportFilterProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent" />
      <div className="flex items-center gap-1 overflow-x-auto pr-6 scrollbar-none">
        <TabPill active={activeSport === "all"} onClick={() => onSelect("all")}>
          All Sports
        </TabPill>
        {UI_SPORTS.map((key) => {
          const sport = SPORT_CONFIG[key];
          return (
            <TabPill
              key={key}
              active={activeSport === key}
              onClick={() => onSelect(key)}
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
      className={`relative shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="analytics-sport-indicator"
          className="absolute inset-0 rounded-md bg-primary shadow-sm"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-[1]">{children}</span>
    </button>
  );
}
