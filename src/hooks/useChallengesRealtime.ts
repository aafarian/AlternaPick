"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Challenge } from "@/lib/supabase/types";

interface UseChallengesRealtimeParams {
  userId: string | undefined;
  supabase: SupabaseClient<Database>;
  onInsert?: (challenge: Challenge) => void;
  onUpdate?: (challenge: Challenge) => void;
}

/**
 * Subscribes to Supabase Realtime `postgres_changes` on the `challenges` table,
 * filtered to rows where `challenger_id` or `opponent_id` equals the current user.
 *
 * Implements exponential backoff retry (up to 10 retries) on CHANNEL_ERROR/TIMED_OUT.
 * Mirrors the retry/cleanup pattern from Header.tsx.
 *
 * Returns `{ isConnected }` for an optional UI connection indicator.
 */
export function useChallengesRealtime({
  userId,
  supabase,
  onInsert,
  onUpdate,
}: UseChallengesRealtimeParams): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);

  // Keep callbacks in refs so the channel subscription doesn't re-create
  // every time the consumer's callbacks change identity.
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!userId || !supabase) return;

    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const MAX_RETRIES = 10;

    function subscribe() {
      if (cancelled) return;

      const channel = supabase
        .channel(`challenges-realtime-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "challenges",
            filter: `challenger_id=eq.${userId},opponent_id=eq.${userId}`,
          },
          (payload) => {
            onInsertRef.current?.(payload.new as Challenge);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "challenges",
            filter: `challenger_id=eq.${userId},opponent_id=eq.${userId}`,
          },
          (payload) => {
            onUpdateRef.current?.(payload.new as Challenge);
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            retryCount = 0;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setIsConnected(false);
            // Remove broken channel and retry with exponential backoff
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
      setIsConnected(false);
      clearTimeout(retryTimeout);
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [userId, supabase]);

  return { isConnected };
}
