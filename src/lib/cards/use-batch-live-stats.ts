"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { LiveCardData } from "./live-types";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export function useBatchLiveStats(
  cardIds: string[],
  enabled: boolean,
  onAllSettled?: () => void,
): { dataMap: Map<string, LiveCardData>; isLoading: boolean; error: string | null } {
  const [dataMap, setDataMap] = useState<Map<string, LiveCardData>>(new Map());
  const [isLoading, setIsLoading] = useState(enabled && cardIds.length > 0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);
  const hadLiveRef = useRef(false);

  // Stable stringified key to prevent re-renders when array reference changes
  const idsKey = useMemo(() => cardIds.slice().sort().join(","), [cardIds]);

  const fetchBatch = useCallback(async () => {
    if (stoppedRef.current || !idsKey) return;

    setIsLoading((prev) => !prev && prev === false ? true : prev);

    const controller = new AbortController();

    try {
      const response = await fetch(`/api/cards/live?ids=${idsKey}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      const cardsObj = result.cards as Record<string, LiveCardData>;

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

      // Track and detect transition from "had live games" to "no live games"
      const anyLive = Object.values(cardsObj).some((c) => c.has_live_games);
      if (anyLive) hadLiveRef.current = true;
      if (!anyLive && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        stoppedRef.current = true;
        if (hadLiveRef.current) {
          onAllSettled?.();
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Failed to fetch live stats");
      }
    } finally {
      setIsLoading(false);
    }
  }, [idsKey, onAllSettled]);

  useEffect(() => {
    if (!enabled || !idsKey) return;

    stoppedRef.current = false;

    // Fetch immediately
    fetchBatch();

    // Set up polling
    intervalRef.current = setInterval(fetchBatch, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stoppedRef.current = true;
    };
  }, [enabled, fetchBatch]);

  return { dataMap, isLoading, error };
}
