"use client";

import { useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { StatCategory } from "@/lib/supabase/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const DRAG_THRESHOLD = 8;

export default function CategoryFilter({ sport = "nba" }: { sport?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0 });

  const active = searchParams.get("category") ?? "all";
  const categories = sport === "epl" ? EPL_CATEGORIES : NBA_CATEGORIES;

  function handleChange(value: string) {
    if (dragState.current.dragging) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", value);
    router.push(`/props?${params.toString()}`);
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { dragging: false, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el || !el.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) dragState.current.dragging = true;
    if (dragState.current.dragging) {
      el.scrollLeft = dragState.current.scrollLeft - dx;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    el.releasePointerCapture(e.pointerId);
    // Reset after a frame so capture handler below can block the click
    requestAnimationFrame(() => { dragState.current.dragging = false; });
  }, []);

  // Block click events during drag — capture phase runs before Radix triggers
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (dragState.current.dragging) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
        className="h-auto max-w-full cursor-grab justify-start gap-1.5 overflow-x-auto overflow-y-hidden bg-transparent p-0 active:cursor-grabbing scrollbar-none"
      >
        {categories.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex-none cursor-pointer rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all select-none data-[state=active]:border-primary data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_10px_rgba(0,210,106,0.15)]"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
