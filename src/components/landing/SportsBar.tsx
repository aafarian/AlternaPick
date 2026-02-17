"use client";

import { ScrollReveal } from "@/components/motion";

const sports = [
  { label: "NBA", emoji: "🏀" },
  { label: "College Hoops", emoji: "🎓" },
  { label: "Premier League", emoji: "⚽" },
  { label: "La Liga", emoji: "⚽" },
  { label: "NHL", badge: "Soon" },
  { label: "& More", badge: "Coming" },
];

export function SportsBar() {
  return (
    <ScrollReveal className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-3 border-y border-border/40 bg-card/30 px-4 py-6 backdrop-blur-sm">
        <span className="mr-2 text-sm font-medium text-muted-foreground">
          Supported sports
        </span>
        {sports.map((sport) => (
          <div
            key={sport.label}
            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-sm font-medium"
          >
            {sport.emoji && <span>{sport.emoji}</span>}
            <span>{sport.label}</span>
            {sport.badge && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                {sport.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </ScrollReveal>
  );
}
