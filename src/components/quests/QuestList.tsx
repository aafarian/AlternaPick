"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { logWarn } from "@/lib/logger";
import { toast } from "sonner";
import type { QuestKey } from "@/lib/heatscore/constants";

interface QuestItem {
  key: QuestKey;
  label: string;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

interface QuestListProps {
  /** Compact mode hides the header and uses smaller text */
  compact?: boolean;
  /** Called when quests are fetched (passes newly claimed items) */
  onFetched?: (newlyClaimed: { key: QuestKey; reward: number }[]) => void;
}

/** Navigation targets for each quest — clicking takes you where you can complete it */
const QUEST_LINKS: Partial<Record<QuestKey, string>> = {
  add_friend: "/friends",
  challenge_friend: "/challenges",
  wager_card: "/props",
  three_cards: "/props",
};

export default function QuestList({ compact = false, onFetched }: QuestListProps) {
  const router = useRouter();
  const [quests, setQuests] = useState<QuestItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchQuests = useCallback(async () => {
    if (fetchedRef.current || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/quests");
      if (!res.ok) return;
      const data = await res.json();
      setQuests(data.quests);

      const newlyClaimed = data.newlyClaimed ?? [];
      for (const claimed of newlyClaimed) {
        const questLabel = data.quests.find((q: QuestItem) => q.key === claimed.key)?.label ?? claimed.key;
        toast.success(`Quest complete: ${questLabel} +${claimed.reward}`);
        window.dispatchEvent(new Event("flame-tokens-changed"));
      }

      onFetched?.(newlyClaimed);
      fetchedRef.current = true;
    } catch (err) {
      logWarn("quest-list", "Failed to fetch quests", err);
    } finally {
      setLoading(false);
    }
  }, [loading, onFetched]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  if (loading || !quests) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <div className="flex flex-col gap-1">
      {!compact && (
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Daily Quests
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {completedCount}/{quests.length}
          </p>
        </div>
      )}
      {quests.map((q) => {
        const link = QUEST_LINKS[q.key];
        const isClickable = !q.completed && link;

        return (
          <button
            key={q.key}
            type="button"
            disabled={!isClickable}
            onClick={() => {
              if (isClickable) router.push(link);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors",
              compact ? "text-[10px]" : "text-xs",
              q.key === "all_complete" && "mt-0.5 border border-amber-500/20 bg-amber-500/5",
              q.completed && q.key !== "all_complete" && "opacity-60",
              isClickable && "cursor-pointer hover:bg-white/[0.03]",
              !isClickable && "cursor-default",
            )}
          >
            {q.completed ? (
              <Check className="h-3 w-3 shrink-0 text-neon-green" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 text-muted-foreground/30" />
            )}
            <span className={cn("flex-1", q.completed && "line-through")}>
              {q.label}
            </span>
            <span className={cn(
              "shrink-0 font-bold tabular-nums",
              q.completed ? "text-neon-green" : "text-muted-foreground",
            )}>
              +{q.reward}
            </span>
          </button>
        );
      })}
    </div>
  );
}
