"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getMondayOfWeek } from "@/lib/recaps/dates";

interface ModeToggleProps {
  mode: "daily" | "weekly";
}

export function ModeToggle({ mode }: ModeToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Optimistic local state to prevent flicker during navigation
  const [displayMode, setDisplayMode] = useState(mode);

  // Sync with server prop when it catches up
  useEffect(() => {
    setDisplayMode(mode);
  }, [mode]);

  const switchMode = useCallback(
    (newMode: "daily" | "weekly") => {
      if (newMode === displayMode) return;
      setDisplayMode(newMode);

      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", newMode);

      if (newMode === "weekly") {
        const currentDate = params.get("date") ?? new Date().toISOString().slice(0, 10);
        params.set("date", getMondayOfWeek(currentDate));
      } else {
        params.delete("date");
      }

      router.push(`/recap?${params.toString()}`);
    },
    [displayMode, router, searchParams],
  );

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      <button
        onClick={() => switchMode("daily")}
        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
          displayMode === "daily"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Daily
      </button>
      <button
        onClick={() => switchMode("weekly")}
        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
          displayMode === "weekly"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Weekly
      </button>
    </div>
  );
}
