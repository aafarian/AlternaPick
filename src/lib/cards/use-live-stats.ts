"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveCardData } from "./live-types";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export function useLiveStats(cardId: string, enabled: boolean, onAllSettled?: () => void) {
  const [data, setData] = useState<LiveCardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);
  const hadLiveRef = useRef(false);

  const fetchLive = useCallback(async () => {
    if (stoppedRef.current) return;

    setIsLoading((prev) => !prev && prev === false ? true : prev);
    try {
      const response = await fetch(`/api/cards/${cardId}/live`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result: LiveCardData = await response.json();
      setData(result);
      setError(null);

      // Track and detect transition from "had live games" to "no live games"
      if (result.has_live_games) hadLiveRef.current = true;
      if (!result.has_live_games && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        stoppedRef.current = true;
        if (hadLiveRef.current) {
          onAllSettled?.();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch live stats");
    } finally {
      setIsLoading(false);
    }
  }, [cardId, onAllSettled]);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;

    // Fetch immediately
    fetchLive();

    // Set up polling
    intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stoppedRef.current = true;
    };
  }, [enabled, fetchLive]);

  return { data, isLoading, error, cardResolved: data?.card_resolved ?? false };
}
