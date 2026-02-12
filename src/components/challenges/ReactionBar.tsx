"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ReactionEmoji } from "@/lib/supabase/types";
import type { ReactionWithUser, ReactionCounts } from "@/lib/reactions/types";

/* ---------- Emoji config ---------- */

const EMOJI_CONFIG: {
  key: ReactionEmoji;
  char: string;
  label: string;
}[] = [
  { key: "fire", char: "\uD83D\uDD25", label: "Fire" },
  { key: "skull", char: "\uD83D\uDC80", label: "Dead" },
  { key: "crying", char: "\uD83D\uDE2D", label: "Crying" },
  { key: "clown", char: "\uD83E\uDD21", label: "Clown" },
  { key: "goat", char: "\uD83D\uDC10", label: "GOAT" },
];

/* ---------- Types ---------- */

interface ReactionBarProps {
  targetType: "challenge" | "card";
  targetId: string;
  currentUserId: string;
}

interface ReactionsState {
  counts: ReactionCounts;
  userEmoji: ReactionEmoji | null;
}

/* ---------- Component ---------- */

export default function ReactionBar({
  targetType,
  targetId,
  currentUserId,
}: ReactionBarProps) {
  const [state, setState] = useState<ReactionsState>({
    counts: {},
    userEmoji: null,
  });
  const [loading, setLoading] = useState(true);

  // Fetch initial reactions
  const fetchReactions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reactions/${targetType}/${targetId}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        reactions: ReactionWithUser[];
        counts: ReactionCounts;
      };

      // Find the current user's reaction
      const myReaction = data.reactions.find(
        (r) => r.user_id === currentUserId
      );

      setState({
        counts: data.counts,
        userEmoji: myReaction?.emoji ?? null,
      });
    } catch {
      // Silently fail — reactions are non-critical
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId, currentUserId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  async function handleEmojiClick(emoji: ReactionEmoji) {
    const prevState = { ...state, counts: { ...state.counts } };
    const isRemoving = state.userEmoji === emoji;
    const previousEmoji = state.userEmoji;

    // Optimistic update
    setState((prev) => {
      const newCounts = { ...prev.counts };

      if (isRemoving) {
        // Remove reaction
        const current = newCounts[emoji] ?? 0;
        if (current <= 1) {
          delete newCounts[emoji];
        } else {
          newCounts[emoji] = current - 1;
        }
        return { counts: newCounts, userEmoji: null };
      }

      // Add or change reaction
      if (previousEmoji) {
        // Decrement old emoji
        const oldCount = newCounts[previousEmoji] ?? 0;
        if (oldCount <= 1) {
          delete newCounts[previousEmoji];
        } else {
          newCounts[previousEmoji] = oldCount - 1;
        }
      }
      newCounts[emoji] = (newCounts[emoji] ?? 0) + 1;
      return { counts: newCounts, userEmoji: emoji };
    });

    try {
      if (isRemoving) {
        const res = await fetch("/api/reactions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
          }),
        });
        if (!res.ok) throw new Error("DELETE failed");
      } else {
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_type: targetType,
            target_id: targetId,
            emoji,
          }),
        });
        if (!res.ok) throw new Error("POST failed");
      }
    } catch {
      // Revert on error
      setState(prevState);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5">
        {EMOJI_CONFIG.map((e) => (
          <div
            key={e.key}
            className="h-8 w-10 animate-pulse rounded-full bg-muted/30"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {EMOJI_CONFIG.map((emoji) => {
        const count = state.counts[emoji.key] ?? 0;
        const isActive = state.userEmoji === emoji.key;

        return (
          <button
            key={emoji.key}
            type="button"
            onClick={() => handleEmojiClick(emoji.key)}
            title={emoji.label}
            className={cn(
              "group relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm transition-all",
              "hover:bg-muted/40 active:scale-95",
              isActive
                ? "border border-primary/50 bg-primary/10 shadow-sm"
                : "border border-transparent bg-muted/20",
              count > 0 && !isActive && "border-border/50"
            )}
          >
            <span className="text-base leading-none">{emoji.char}</span>
            {count > 0 && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
            {/* Tooltip */}
            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-0.5 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {emoji.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
