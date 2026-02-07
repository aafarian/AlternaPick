"use client";

import { useRouter } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { createCard } from "@/lib/cards/api";
import { getAnonymousId } from "@/lib/session/anonymous";
import { CATEGORY_LABELS } from "@/lib/constants";

export default function CardBuilderPanel() {
  const router = useRouter();
  const { state, removePick, clearCard, setLocking, setError, isFull } =
    useCardBuilder();
  const { picks, isLocking, error } = state;

  if (picks.length === 0) return null;

  async function handleLockIn() {
    if (!isFull || isLocking) return;

    setLocking(true);
    setError(null);

    try {
      const anonId = getAnonymousId();
      await createCard(
        picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        anonId
      );
      clearCard();
      router.push("/cards");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lock in card"
      );
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {error && (
          <div className="mb-2 rounded-md bg-red-500/10 px-3 py-1.5 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Pick count */}
          <div className="shrink-0">
            <span className="text-sm font-semibold">
              {picks.length}/{state.maxPicks} Picks
            </span>
          </div>

          {/* Scrollable picks list */}
          <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide">
            {picks.map((pick) => (
              <div
                key={pick.prop_id}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background/50 px-2.5 py-1.5"
              >
                <span className="text-xs font-medium">
                  {pick.player_name.split(" ").pop()}
                </span>
                <span className="text-xs text-muted">
                  {CATEGORY_LABELS[pick.stat_category] ?? pick.stat_category}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    pick.selection === "over"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {pick.selection === "over" ? "O" : "U"} {pick.line}
                </span>
                <button
                  onClick={() => removePick(pick.prop_id)}
                  className="ml-1 text-muted hover:text-foreground"
                  aria-label={`Remove ${pick.player_name}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={clearCard}
              disabled={isLocking}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handleLockIn}
              disabled={!isFull || isLocking}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                isFull && !isLocking
                  ? "bg-indigo-500 text-white hover:bg-indigo-600"
                  : "cursor-not-allowed bg-indigo-500/30 text-indigo-300/50"
              }`}
            >
              {isLocking ? "Locking..." : "Lock In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
