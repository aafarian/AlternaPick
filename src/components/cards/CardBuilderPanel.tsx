"use client";

import { useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { createCard } from "@/lib/cards/api";
import { getAnonymousId } from "@/lib/session/anonymous";
import { CATEGORY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Lock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CardSuccessAnimation from "./CardSuccessAnimation";

export default function CardBuilderPanel() {
  const router = useRouter();
  const {
    state,
    removePick,
    clearCard,
    setLocking,
    setError,
    showSuccess,
    hideSuccess,
    isFull,
  } = useCardBuilder();
  const { picks, isLocking, error, challengeId, challengeOpponent } = state;
  const redirectRef = useRef<string | null>(null);

  const handleAnimationDismiss = useCallback(() => {
    hideSuccess();
    clearCard();
    if (redirectRef.current) {
      router.push(redirectRef.current);
      redirectRef.current = null;
    }
  }, [hideSuccess, clearCard, router]);

  if (picks.length === 0 && !challengeId && !state.showSuccess) return null;

  const opponentLabel =
    challengeOpponent?.display_name ?? challengeOpponent?.username ?? null;

  async function handleLockIn() {
    if (!isFull || isLocking) return;

    setLocking(true);
    setError(null);

    try {
      const anonId = getAnonymousId();
      await createCard(
        picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        anonId,
        challengeId
      );
      redirectRef.current = challengeId
        ? `/challenges/${challengeId}`
        : "/picks";
      showSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lock in card"
      );
    }
  }

  return (
    <>
      {state.showSuccess && (
        <CardSuccessAnimation onDismiss={handleAnimationDismiss} />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3">
          {/* Challenge banner */}
          {challengeId && opponentLabel && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <span className="text-sm font-semibold text-orange-400">
                Challenge vs. {opponentLabel}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between gap-2 sm:order-none sm:contents">
              <div className="shrink-0">
                <span className="text-sm font-bold">
                  {picks.length}/{state.maxPicks} Picks
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={clearCard}
                  disabled={isLocking}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleLockIn}
                  disabled={!isFull || isLocking}
                  size="sm"
                  className={cn(
                    "font-bold",
                    isFull && !isLocking && "animate-pulse shadow-[0_0_20px_rgba(0,210,106,0.4)]",
                    challengeId
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : ""
                  )}
                >
                  {isLocking ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Locking...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      {challengeId ? "Lock In Challenge" : "Lock In"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Scrollable picks list */}
            <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide">
              {picks.map((pick) => (
                <Badge
                  key={pick.prop_id}
                  variant="secondary"
                  className="shrink-0 gap-1.5 rounded-lg border border-border px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {pick.player_name.split(" ").pop()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[pick.stat_category] ?? pick.stat_category}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      pick.selection === "over" ? "text-neon-green" : "text-bold-red"
                    )}
                  >
                    {pick.selection === "over" ? "O" : "U"} {pick.line}
                  </span>
                  <button
                    onClick={() => removePick(pick.prop_id)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${pick.player_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
