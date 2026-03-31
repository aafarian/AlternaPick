"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

interface UseParticipantsRealtimeParams {
  challengeId: string;
  currentUserId: string;
  onParticipantChange: () => void;
}

/**
 * Subscribes to Supabase Realtime `postgres_changes` on the
 * `challenge_participants` table, filtered server-side by `challenge_id`.
 *
 * Calls `onParticipantChange` on INSERT or UPDATE events from other users
 * so the lobby can refresh and show the latest participant state.
 *
 * Implements exponential backoff retry (up to 10 retries) on channel errors.
 */
export function useParticipantsRealtime({
  challengeId,
  currentUserId,
  onParticipantChange,
}: UseParticipantsRealtimeParams): void {
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null);
  const onChangeRef = useRef(onParticipantChange);

  useEffect(() => {
    onChangeRef.current = onParticipantChange;
  }, [onParticipantChange]);

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

    // Debounce rapid-fire events (e.g. multiple participants locking in quickly)
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
        .channel(`participants-${challengeId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "challenge_participants",
            filter: `challenge_id=eq.${challengeId}`,
          },
          (payload) => {
            const row = payload.new as { user_id?: string };
            // Skip events from our own actions (already handled optimistically)
            if (row.user_id === currentUserId) return;
            debouncedChange();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "challenge_participants",
            filter: `challenge_id=eq.${challengeId}`,
          },
          (payload) => {
            const row = payload.new as { user_id?: string };
            if (row.user_id === currentUserId) return;
            debouncedChange();
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
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
