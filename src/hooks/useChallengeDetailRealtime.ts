"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

interface UseChallengeDetailRealtimeParams {
  /** The challenge being viewed. */
  challengeId: string;
  /** The current user — events from this user are skipped (already handled
   *  optimistically by the local UI). */
  currentUserId: string;
  /** Called when a relevant change is detected from another user. Typically
   *  wired to `router.refresh()` so the server component re-fetches. */
  onChallengeChange: () => void;
}

/**
 * Subscribes to Supabase Realtime `postgres_changes` on the `challenges` and
 * `cards` tables for a single challenge ID. Calls `onChallengeChange` when
 * a relevant state change is detected:
 *
 *   - Challenge status transition → challenge UPDATE (accept, activate, resolve)
 *   - Opponent locks in picks → card INSERT (challenge_id = this challenge)
 *   - Card status change → card UPDATE (draft→locked, locked→resolved)
 *
 * Card events skip the current user's own actions (already handled
 * optimistically). Challenge UPDATEs cannot be filtered by actor — the
 * `challenges` row doesn't carry a "who triggered this" field — so the
 * current user's own actions (accept, cancel) will trigger a harmless
 * extra debounced refresh alongside the optimistic handler. This is by
 * design: the cost of one redundant fetch is negligible compared to the
 * complexity of tracking actor identity in the realtime payload.
 *
 * Mirrors the retry/backoff/debounce pattern from `useParticipantsRealtime`.
 *
 * Requires the tables to be in the `supabase_realtime` publication — see
 * migration 053_enable_challenge_realtime.sql.
 */
export function useChallengeDetailRealtime({
  challengeId,
  currentUserId,
  onChallengeChange,
}: UseChallengeDetailRealtimeParams): void {
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null);
  const onChangeRef = useRef(onChallengeChange);

  useEffect(() => {
    onChangeRef.current = onChallengeChange;
  }, [onChallengeChange]);

  useEffect(() => {
    if (!challengeId || !currentUserId) return;

    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    const supabase = supabaseRef.current;

    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const MAX_RETRIES = 10;

    // Debounce rapid-fire events (e.g. challenge status + card insert arrive
    // within milliseconds of each other from a single opponent action).
    let debounceTimer: ReturnType<typeof setTimeout>;
    function debouncedChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onChangeRef.current();
      }, 300);
    }

    function subscribe() {
      if (cancelled) return;

      const channel = supabase
        .channel(`challenge-detail-${challengeId}-${Date.now()}`)
        // Challenge status changes (accept, activate, resolve, cancel)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "challenges",
            filter: `id=eq.${challengeId}`,
          },
          () => {
            // Challenge updates are always relevant — the opponent can't
            // trigger an update on a challenge they're not part of, and the
            // server-side filter already scopes to this challenge ID.
            debouncedChange();
          },
        )
        // Opponent creates their card for this challenge
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "cards",
            filter: `challenge_id=eq.${challengeId}`,
          },
          (payload) => {
            const row = payload.new as { user_id?: string };
            if (row.user_id === currentUserId) return;
            debouncedChange();
          },
        )
        // Card status changes (draft→locked, locked→resolved)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "cards",
            filter: `challenge_id=eq.${challengeId}`,
          },
          (payload) => {
            const row = payload.new as { user_id?: string };
            if (row.user_id === currentUserId) return;
            debouncedChange();
          },
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            if (retryCount > 0) {
              // Reconnected after an outage — catch up on anything missed.
              debouncedChange();
            }
            retryCount = 0;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            supabase.removeChannel(channel);
            channelRef = null;

            if (!cancelled && retryCount < MAX_RETRIES) {
              const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
              retryTimeout = setTimeout(() => {
                retryCount++;
                subscribe();
              }, delay);
            }
          }
        });

      channelRef = channel;
    }

    subscribe();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      clearTimeout(debounceTimer);
      if (channelRef && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef);
      }
    };
  }, [challengeId, currentUserId]);
}
