"use client";

import { type ReactNode } from "react";
import { StaggerChildren, StaggerItem } from "@/components/motion";

interface ProfileStatsGridProps {
  children: ReactNode;
}

/**
 * Client wrapper for the profile stats grid.
 * Provides staggered entrance animations via StaggerChildren/StaggerItem.
 */
export function ProfileStatsGrid({ children }: ProfileStatsGridProps) {
  return (
    <StaggerChildren
      staggerDelay={0.07}
      className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5"
    >
      {children}
    </StaggerChildren>
  );
}

/**
 * Individual stat card with stagger animation and hover effect.
 */
export function ProfileStatCard({ children }: { children: ReactNode }) {
  return (
    <StaggerItem>
      <div className="rounded-xl border border-border bg-background/50 p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        {children}
      </div>
    </StaggerItem>
  );
}
