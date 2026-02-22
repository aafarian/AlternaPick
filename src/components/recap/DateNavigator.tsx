"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMondayOfWeek, getSundayOfWeek } from "@/lib/recaps/dates";

interface DateNavigatorProps {
  currentDate: string;
  availableDates: string[];
  mode?: "daily" | "weekly";
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatPillDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Format a Mon-Sun week range, e.g. "Feb 10 - 16" or "Jan 27 - Feb 2" */
function formatWeekRange(monday: string): string {
  const sunday = getSundayOfWeek(monday);
  const monDate = new Date(`${monday}T00:00:00Z`);
  const sunDate = new Date(`${sunday}T00:00:00Z`);

  const monMonth = monDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const sunMonth = sunDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const monDay = monDate.getUTCDate();
  const sunDay = sunDate.getUTCDate();

  if (monMonth === sunMonth) {
    return `${monMonth} ${monDay} - ${sunDay}`;
  }
  return `${monMonth} ${monDay} - ${sunMonth} ${sunDay}`;
}

/** Group available dates into Mon-Sun weeks, returning Monday of each week */
function groupIntoWeeks(dates: string[]): string[] {
  const mondays = new Set<string>();
  for (const date of dates) {
    mondays.add(getMondayOfWeek(date));
  }
  return [...mondays].sort();
}

export function DateNavigator({
  currentDate,
  availableDates,
  mode = "daily",
}: DateNavigatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const isWeekly = mode === "weekly";

  // For weekly mode, group dates into weeks
  const weekMondays = useMemo(
    () => (isWeekly ? groupIntoWeeks(availableDates) : []),
    [isWeekly, availableDates],
  );

  // The list of navigable items (dates or week-mondays)
  const items = isWeekly ? weekMondays : availableDates;

  // For weekly mode, the active item is the Monday of the current date's week
  const activeItem = isWeekly ? getMondayOfWeek(currentDate) : currentDate;

  const currentIndex = useMemo(
    () => items.indexOf(activeItem),
    [items, activeItem],
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const navigate = useCallback(
    (date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date);
      router.push(`/recap?${params.toString()}`);
    },
    [router, searchParams],
  );

  const goPrev = useCallback(() => {
    if (hasPrev) navigate(items[currentIndex - 1]);
  }, [hasPrev, navigate, items, currentIndex]);

  const goNext = useCallback(() => {
    if (hasNext) navigate(items[currentIndex + 1]);
  }, [hasNext, navigate, items, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  // Auto-scroll active pill into view on mount
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeItem]);

  const yesterday = getYesterday();

  // Show items in reverse chronological order (newest first)
  const reversedItems = [...items].reverse();

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5"
    >
      {reversedItems.map((item) => {
        const isActive = item === activeItem;

        if (isWeekly) {
          return (
            <button
              key={item}
              ref={isActive ? activeRef : undefined}
              onClick={() => navigate(item)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {formatWeekRange(item)}
            </button>
          );
        }

        const isYesterday = item === yesterday;
        return (
          <button
            key={item}
            ref={isActive ? activeRef : undefined}
            onClick={() => navigate(item)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {isYesterday ? "Yesterday" : formatPillDate(item)}
          </button>
        );
      })}
    </div>
  );
}
