"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { StatCategory } from "@/lib/supabase/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type CategoryOption = { value: StatCategory | "all"; label: string };

const NBA_CATEGORIES: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "points", label: "Points" },
  { value: "rebounds", label: "Rebounds" },
  { value: "assists", label: "Assists" },
  { value: "threes", label: "3PM" },
  { value: "steals", label: "Steals" },
  { value: "blocks", label: "Blocks" },
  { value: "turnovers", label: "Turnovers" },
  { value: "pra", label: "PRA" },
  { value: "pts_reb", label: "Pts+Reb" },
  { value: "pts_ast", label: "Pts+Ast" },
  { value: "reb_ast", label: "Reb+Ast" },
  { value: "blk_stl", label: "Blk+Stl" },
];

const EPL_CATEGORIES: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "shots", label: "Shots" },
  { value: "shots_on_target", label: "On Target" },
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
];

const SCROLL_SPEED = 3; // px per frame

export default function CategoryFilter({ sport = "nba" }: { sport?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollDir = useRef<"left" | "right" | null>(null);
  const rafRef = useRef<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const active = searchParams.get("category") ?? "all";
  const categories = sport === "epl" || sport === "la_liga" ? EPL_CATEGORIES : NBA_CATEGORIES;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", value);
    router.push(`/props?${params.toString()}`);
  }

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, categories]);

  // Animation loop for hover-to-scroll
  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !scrollDir.current) return;
    el.scrollLeft += scrollDir.current === "right" ? SCROLL_SPEED : -SCROLL_SPEED;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startScroll = useCallback((dir: "left" | "right") => {
    scrollDir.current = dir;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopScroll = useCallback(() => {
    scrollDir.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <div className="relative">
        {/* Left fade + hover zone */}
        <div
          onMouseEnter={() => startScroll("left")}
          onMouseLeave={stopScroll}
          className={cn(
            "pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
            canScrollLeft ? "pointer-events-auto opacity-100" : "opacity-0"
          )}
        />

        {/* Right fade + hover zone */}
        <div
          onMouseEnter={() => startScroll("right")}
          onMouseLeave={stopScroll}
          className={cn(
            "pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
            canScrollRight ? "pointer-events-auto opacity-100" : "opacity-0"
          )}
        />

        <TabsList
          ref={scrollRef}
          className="h-auto max-w-full justify-start gap-1.5 overflow-x-auto overflow-y-hidden bg-transparent p-0 scrollbar-none"
        >
          {categories.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-none cursor-pointer rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_10px_rgba(0,210,106,0.15)]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
