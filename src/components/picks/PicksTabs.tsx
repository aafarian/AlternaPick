"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { ReactNode } from "react";

type TabKey = "live" | "finished";

function isValidTab(v: string | null): v is TabKey {
  return v === "live" || v === "finished";
}

interface PicksTabsProps {
  liveCount: number;
  finishedCount: number;
  liveContent: ReactNode;
  finishedContent: ReactNode;
}

export default function PicksTabs({
  liveCount,
  finishedCount,
  liveContent,
  finishedContent,
}: PicksTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = isValidTab(tabParam) ? tabParam : "live";

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "live") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    router.replace(`/picks${params.size ? `?${params}` : ""}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="bg-secondary">
        <TabsTrigger value="live" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
          Live ({liveCount})
        </TabsTrigger>
        <TabsTrigger value="finished" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
          Finished ({finishedCount})
        </TabsTrigger>
      </TabsList>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -6 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.2, ease: "easeInOut" }}
          >
            {activeTab === "live" ? liveContent : finishedContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
