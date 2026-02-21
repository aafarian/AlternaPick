"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavigatorProps {
  currentDate: string; // YYYY-MM-DD of currently displayed recap
  availableDates: string[]; // All dates that have recaps, sorted ascending
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
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

  const isYesterday = currentDate === getYesterday();
  const dateLabel = formatDate(currentDate);

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-2 py-1.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        disabled={!hasPrev}
        onClick={goPrev}
        aria-label="Previous recap date"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex flex-col items-center min-w-0">
        <span className="text-sm font-semibold text-foreground truncate">
          {dateLabel}
        </span>
        {isYesterday && (
          <span className="text-[10px] font-medium text-muted-foreground">
            Yesterday
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        disabled={!hasNext}
        onClick={goNext}
        aria-label="Next recap date"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
