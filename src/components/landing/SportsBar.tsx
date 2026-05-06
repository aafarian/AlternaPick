"use client";

import { ScrollReveal } from "@/components/motion";
import { Circle, GraduationCap, Trophy, type LucideIcon } from "lucide-react";

const sports: { label: string; icon?: LucideIcon; badge?: string }[] = [
  { label: "NBA", icon: Circle },
  { label: "College Hoops", icon: GraduationCap },
  { label: "Premier League", icon: Trophy },
  { label: "La Liga", icon: Trophy },
  { label: "NHL", icon: Circle },
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
            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_0_12px_rgba(0,210,106,0.1)]"
          >
            {sport.icon && <sport.icon className="h-4 w-4 text-primary" />}
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
