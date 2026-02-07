"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { StatCategory } from "@/lib/supabase/types";

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
  const active = searchParams.get("category") ?? "all";

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("category");
    } else {
      params.set("category", value);
    }
    router.push(`/props?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {CATEGORIES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleClick(value)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            active === value
              ? "bg-accent text-white"
              : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
