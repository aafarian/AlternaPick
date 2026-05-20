"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import QuestList from "./QuestList";
import { cn } from "@/lib/utils";

/**
 * Collapsible banner promoting daily quests.
 * Shown at the top of the props page to drive engagement.
 */
export default function QuestBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-orange-400">
          <FlameTokenIcon className="h-3.5 w-3.5" />
          Complete your daily quests for more Flame Coins!
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 text-orange-400 transition-transform",
          expanded && "rotate-180",
        )} />
      </button>
      {expanded && (
        <div className="border-t border-orange-500/10 px-4 pb-3 pt-2">
          <QuestList />
        </div>
      )}
    </div>
  );
}
