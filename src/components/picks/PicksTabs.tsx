"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

interface PicksTabsProps {
  defaultTab: string;
  liveCount: number;
  finishedCount: number;
  liveContent: ReactNode;
  finishedContent: ReactNode;
}

export default function PicksTabs({
  defaultTab,
  liveCount,
  finishedCount,
  liveContent,
  finishedContent,
}: PicksTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "live") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    router.replace(`/picks${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <Tabs defaultValue={defaultTab} onValueChange={handleTabChange}>
      <TabsList className="bg-secondary">
        <TabsTrigger value="live" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
          Live ({liveCount})
        </TabsTrigger>
        <TabsTrigger value="finished" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
          Finished ({finishedCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="live" className="mt-4">
        {liveContent}
      </TabsContent>

      <TabsContent value="finished" className="mt-4">
        {finishedContent}
      </TabsContent>
    </Tabs>
  );
}
