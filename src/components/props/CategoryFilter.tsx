"use client";

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

export default function CategoryFilter({ sport = "nba" }: { sport?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultCategory = sport === "epl" ? "shots" : "points";
  const active = searchParams.get("category") ?? defaultCategory;
  const categories = sport === "epl" ? EPL_CATEGORIES : NBA_CATEGORIES; // NCAAB uses same basketball categories as NBA

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", value);
    router.push(`/props?${params.toString()}`);
  }

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList className="h-auto max-w-full justify-start gap-1.5 overflow-x-auto bg-transparent p-0 scrollbar-none">
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
    </Tabs>
  );
}
