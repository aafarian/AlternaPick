"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface DateNavigatorProps {
  currentDate: string;
  availableDates: string[];
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

export function DateNavigator({
  currentDate,
  availableDates,
}: DateNavigatorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const currentIndex = useMemo(
    () => availableDates.indexOf(currentDate),
    [availableDates, currentDate],
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < availableDates.length - 1;

  const navigate = useCallback(
    (date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date);
      router.push(`/recap?${params.toString()}`);
    },
    [router, searchParams],
  );

  const goPrev = useCallback(() => {
    if (hasPrev) navigate(availableDates[currentIndex - 1]);
  }, [hasPrev, navigate, availableDates, currentIndex]);

  const goNext = useCallback(() => {
    if (hasNext) navigate(availableDates[currentIndex + 1]);
  }, [hasNext, navigate, availableDates, currentIndex]);

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
  }, [currentDate]);

  const yesterday = getYesterday();

  // Show dates in reverse chronological order (newest first)
  const reversedDates = [...availableDates].reverse();

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5"
    >
      {reversedDates.map((date) => {
        const isActive = date === currentDate;
        const isYesterday = date === yesterday;

        return (
          <button
            key={date}
            ref={isActive ? activeRef : undefined}
            onClick={() => navigate(date)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {isYesterday ? "Yesterday" : formatPillDate(date)}
          </button>
        );
      })}
    </div>
  );
}
