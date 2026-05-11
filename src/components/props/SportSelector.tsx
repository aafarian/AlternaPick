"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_SPORTS, SPORT_CONFIG } from "@/lib/sports";

interface SportSelectorProps {
  counts?: Record<string, number>;
  activeSport?: string;
}

export default function SportSelector({ counts, activeSport }: SportSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("sport") ?? activeSport ?? "nba";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sport", value);
    // Reset category when switching sports (different categories per sport)
    params.delete("category");
    params.delete("player");
    router.push(`/props?${params.toString()}`);
  }

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList className="h-auto w-fit justify-start gap-0.5 bg-transparent p-0">
        {UI_SPORTS.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="relative flex-none cursor-pointer rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:text-foreground data-[state=active]:border-b-primary data-[state=active]:text-primary"
          >
            {SPORT_CONFIG[key].shortLabel}
            {counts?.[key] ? (
              <span className="ml-1 text-[10px] opacity-60">({counts[key]})</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
