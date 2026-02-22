"use client";

import { StaggerChildren, StaggerItem } from "@/components/motion";
import { AnimatedNumber } from "@/components/recap/AnimatedNumber";
import { Hash, BarChart3, Target } from "lucide-react";

interface PlatformStatsProps {
  totalPicks: number;
  totalCards: number;
  hitRatePercent: number;
}

export function PlatformStats({
  totalPicks,
  totalCards,
  hitRatePercent,
}: PlatformStatsProps) {
  return (
    <StaggerChildren className="grid grid-cols-3 gap-3" staggerDelay={0.1}>
      <StaggerItem>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total Picks
            </p>
          </div>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
            <AnimatedNumber value={totalPicks} />
          </p>
        </div>
      </StaggerItem>
      <StaggerItem>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total Cards
            </p>
          </div>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
            <AnimatedNumber value={totalCards} />
          </p>
        </div>
      </StaggerItem>
      <StaggerItem>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Hit Rate
            </p>
          </div>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
            <AnimatedNumber value={hitRatePercent} suffix="%" />
          </p>
        </div>
      </StaggerItem>
    </StaggerChildren>
  );
}
