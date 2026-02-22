"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";

const MAX_TOASTED_IDS = 200;

/**
 * Hook that provides a `showChallengeToast` function for displaying toast
 * notifications when new incoming challenges arrive via Realtime.
 *
 * Features:
 * - Deduplicates by challenge ID (same challenge won't toast twice)
 * - Suppresses toasts during initial page load (call `markReady()` after first fetch)
 * - Uses `toast.custom()` styled identically to Header.tsx notification toasts
 * - Bounded dedup set (max 200 entries) to prevent memory growth
 */
export function useChallengeToast() {
  // Dedup set so the same challenge is never toasted twice.
  // Covers overlap between realtime delivery and reconnection catch-up.
  const toastedIdsRef = useRef<Set<string>>(new Set());

  // Gate: no toasts until the page has finished its initial load.
  const readyRef = useRef(false);

  /**
   * Signal that the initial data fetch is complete.
   * Toasts will only fire after this is called.
   */
  const markReady = useCallback(() => {
    readyRef.current = true;
  }, []);

  /**
   * Show a toast for a new incoming challenge.
   *
   * @param challengeId - The ID of the newly inserted challenge
   * @param challenges  - The current coreChallenges array (after refetch), used to
   *                      look up the challenger's profile info for the toast message.
   * @param userId      - The current user's ID, used to identify incoming challenges
   *                      and to look up the challenger (the other party).
   */
  const showChallengeToast = useCallback(
    (
      challengeId: string,
      challenges: ChallengeWithProfiles[],
      userId: string
    ) => {
      // Don't toast during initial page load
      if (!readyRef.current) return;

      // Dedup — same challenge ID should not trigger multiple toasts
      if (toastedIdsRef.current.has(challengeId)) return;
      toastedIdsRef.current.add(challengeId);

      // Prune if the set gets too large
      if (toastedIdsRef.current.size > MAX_TOASTED_IDS) {
        const entries = Array.from(toastedIdsRef.current);
        toastedIdsRef.current = new Set(entries.slice(-100));
      }

      // Find the challenge in the refetched data so we have profile info
      const challenge = challenges.find((c) => c.id === challengeId);

      // Only toast for incoming challenges (where current user is the opponent)
      if (!challenge || challenge.opponent_id !== userId) return;

      const challenger = challenge.challenger;
      const displayName = challenger.display_name || challenger.username;

      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
            }}
            className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-lg transition-colors hover:bg-secondary/50"
          >
            <span className="mt-0.5 text-base leading-none">{"\u2694\uFE0F"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName} challenged you!
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {challenge.game_mode
                  ? `${challenge.game_mode.charAt(0).toUpperCase()}${challenge.game_mode.slice(1)} mode`
                  : "New challenge"}
              </p>
            </div>
          </button>
        ),
        { duration: 5000 }
      );
    },
    []
  );

  return { showChallengeToast, markReady };
}
