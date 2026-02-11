"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { StatCategory } from "@/lib/supabase/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES: { value: StatCategory | "all"; label: string }[] = [
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

export default function CategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("category") ?? "points";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", value);
    router.push(`/props?${params.toString()}`);
  }

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0 scrollbar-none">
        {CATEGORIES.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="shrink-0 cursor-pointer rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[state=active]:border-primary data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_10px_rgba(0,210,106,0.15)]"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
