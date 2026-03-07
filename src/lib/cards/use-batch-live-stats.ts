"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { LiveCardData } from "./live-types";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/lib/constants";

export function useBatchLiveStats(
  cardIds: string[],
  enabled: boolean,
  onAllSettled?: () => void,
): {
  dataMap: Map<string, LiveCardData>;
  isLoading: boolean;
  hasFetched: boolean;
  error: string | null;
} {
  const [dataMap, setDataMap] = useState<Map<string, LiveCardData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmAbortRef = useRef<AbortController | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const skipCountRef = useRef(0);
  const startTimeRef = useRef(0);

  // Stable stringified key to prevent re-renders when array reference changes
  const idsKey = useMemo(() => cardIds.slice().sort().join(","), [cardIds]);

  // Keep onAllSettled in a ref so the fetch callback + effect don't depend on it
  const onAllSettledRef = useRef(onAllSettled);
  onAllSettledRef.current = onAllSettled;

  useEffect(() => {
    if (!enabled || !idsKey) return;

    stoppedRef.current = false;
    setHasFetched(false);
    startTimeRef.current = Date.now();

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
        confirmTimeoutRef.current = null;
      }
      confirmAbortRef.current?.abort();
      confirmAbortRef.current = null;
      stoppedRef.current = true;
      onAllSettledRef.current?.();
    }

    async function fetchBatch() {
      if (stoppedRef.current || !idsKey) return;

      // 6-hour hard timeout — stop polling no matter what
      if (Date.now() - startTimeRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        return;
      }

      // Back off when seeing consecutive errors — skip polls exponentially
      if (consecutiveErrorsRef.current > 0) {
        const skipsNeeded = Math.min(2 ** (consecutiveErrorsRef.current - 1), 8);
        if (skipCountRef.current < skipsNeeded) {
          skipCountRef.current++;
          return;
        }
        skipCountRef.current = 0;
      }

      // Abort any in-flight request before starting a new one
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);

      try {
        const response = await fetch(`/api/cards/live?ids=${idsKey}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        const cardsObj = result.cards as Record<string, LiveCardData>;

        // Don't update state if this request was aborted or hook was stopped
        if (controller.signal.aborted || stoppedRef.current) return;

        setDataMap((prev) => {
          const merged = new Map<string, LiveCardData>();
          for (const [id, data] of Object.entries(cardsObj)) {
            const prevCard = prev.get(id);
            // Preserve last known current_value on each pick so the bar
            // doesn't shrink to 0 when the stats API temporarily returns
            // no boxscore data (e.g. right when a game goes final).
            if (prevCard && data.picks) {
              for (const pick of data.picks) {
                if (pick.current_value === null) {
                  const prevPick = prevCard.picks?.find((p) => p.pick_id === pick.pick_id);
                  if (prevPick?.current_value !== null && prevPick?.current_value !== undefined) {
                    pick.current_value = prevPick.current_value;
                  }
                }
              }
            }
            merged.set(id, data);
          }
          return merged;
        });
        setError(null);
        setHasFetched(true);
        consecutiveErrorsRef.current = 0;

        // Only stop when the server confirms ALL games are final across all cards.
        // Use a confirmation re-fetch to guard against transient false positives.
        const cardValues = Object.values(cardsObj);
        const allFinal = cardValues.length > 0 && cardValues.every((c) => c.all_games_final);
        if (allFinal && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          // Confirmation fetch after 5s
          if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
          confirmAbortRef.current?.abort();
          confirmTimeoutRef.current = setTimeout(async () => {
            confirmTimeoutRef.current = null;
            if (stoppedRef.current) return;
            const confirmController = new AbortController();
            confirmAbortRef.current = confirmController;
            try {
              const res = await fetch(`/api/cards/live?ids=${idsKey}`, {
                signal: confirmController.signal,
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const json = await res.json();
              const confirmed = json.cards as Record<string, LiveCardData>;
              if (stoppedRef.current) return;
              const confirmedValues = Object.values(confirmed);
              const stillAllFinal = confirmedValues.length > 0 && confirmedValues.every((c) => c.all_games_final);
              if (stillAllFinal) {
                setDataMap((prev) => {
                  const merged = new Map<string, LiveCardData>(prev);
                  for (const [id, data] of Object.entries(confirmed)) {
                    const prevCard = prev.get(id);
                    if (prevCard && data.picks) {
                      for (const pick of data.picks) {
                        if (pick.current_value === null) {
                          const prevPick = prevCard.picks?.find((p) => p.pick_id === pick.pick_id);
                          if (prevPick?.current_value !== null && prevPick?.current_value !== undefined) {
                            pick.current_value = prevPick.current_value;
                          }
                        }
                      }
                    }
                    merged.set(id, data);
                  }
                  return merged;
                });
                stopPolling();
              } else {
                // Not actually all final — resume polling
                intervalRef.current = setInterval(fetchBatch, POLL_INTERVAL_MS);
              }
            } catch (confirmErr) {
              if ((confirmErr as Error).name === "AbortError") return;
              // Confirmation failed — resume polling instead of stopping
              if (!stoppedRef.current) {
                intervalRef.current = setInterval(fetchBatch, POLL_INTERVAL_MS);
              }
            }
          }, 5000);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          consecutiveErrorsRef.current++;
          setError(err instanceof Error ? err.message : "Failed to fetch live stats");
          // Even on error, mark as fetched so we show fallback data instead of skeleton forever
          setHasFetched(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    // Fetch immediately
    fetchBatch();

    // Set up polling
    intervalRef.current = setInterval(fetchBatch, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
        confirmTimeoutRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
      confirmAbortRef.current?.abort();
      confirmAbortRef.current = null;
      stoppedRef.current = true;
    };
  }, [enabled, idsKey]);

  return { dataMap, isLoading, hasFetched, error };
}
