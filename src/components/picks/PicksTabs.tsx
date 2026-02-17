"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const prefersReduced = useReducedMotion();

  function handleTabChange(value: string) {
    setActiveTab(value);
    // Update URL for bookmarking without triggering a Next.js server re-render
    const params = new URLSearchParams(searchParams.toString());
    if (value === "live") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const url = `/picks${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", url);
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
