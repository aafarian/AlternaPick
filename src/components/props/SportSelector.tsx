"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SPORTS = [
  { value: "nba", label: "NBA" },
  { value: "epl", label: "Soccer" },
] as const;

export default function SportSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("sport") ?? "nba";

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
      <TabsList className="h-auto w-fit justify-start gap-1.5 bg-transparent p-0">
        {SPORTS.map(({ value, label }) => (
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
