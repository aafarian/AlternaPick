"use client";

import { useState, useEffect, useRef } from "react";
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

/**
 * Global deduplication: multiple QuestList instances share a single fetch
 * to prevent the API from auto-crediting rewards multiple times.
 */
let globalQuestPromise: Promise<{ quests: QuestItem[]; newlyClaimed: { key: QuestKey; reward: number }[] }> | null = null;
let globalQuestResult: { quests: QuestItem[]; newlyClaimed: { key: QuestKey; reward: number }[] } | null = null;

function fetchQuestsGlobal(): Promise<{ quests: QuestItem[]; newlyClaimed: { key: QuestKey; reward: number }[] }> {
  // Return cached result if already fetched this page load
  if (globalQuestResult) return Promise.resolve(globalQuestResult);
  // Deduplicate concurrent calls
  if (globalQuestPromise) return globalQuestPromise;

  globalQuestPromise = fetch("/api/quests")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch quests");
      return res.json();
    })
    .then((data) => {
      const result = {
        quests: data.quests ?? [],
        newlyClaimed: data.newlyClaimed ?? [],
      };
      globalQuestResult = result;
      globalQuestPromise = null;
      return result;
    })
    .catch((err) => {
      globalQuestPromise = null;
      throw err;
    });

  return globalQuestPromise;
}

export default function QuestList({ compact = false, onFetched }: QuestListProps) {
  const router = useRouter();
  const [quests, setQuests] = useState<QuestItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    fetchQuestsGlobal()
      .then((result) => {
        setQuests(result.quests);

        for (const claimed of result.newlyClaimed) {
          const questLabel = result.quests.find((q) => q.key === claimed.key)?.label ?? claimed.key;
          toast.success(`Quest complete: ${questLabel} +${claimed.reward}`);
          window.dispatchEvent(new Event("flame-tokens-changed"));
        }

        onFetched?.(result.newlyClaimed);
      })
      .catch((err) => {
        logWarn("quest-list", "Failed to fetch quests", err);
        fetchedRef.current = false;
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
