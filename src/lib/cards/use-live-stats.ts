"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveCardData } from "./live-types";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export function useLiveStats(cardId: string, enabled: boolean, onAllSettled?: () => void) {
  const [data, setData] = useState<LiveCardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const hadLiveRef = useRef(false);

  // Keep onAllSettled in a ref so the fetch callback doesn't depend on it
  const onAllSettledRef = useRef(onAllSettled);
  onAllSettledRef.current = onAllSettled;

  const fetchLive = useCallback(async () => {
    if (stoppedRef.current) return;

    // Abort any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cards/${cardId}/live`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result: LiveCardData = await response.json();

      // Don't update state if this request was aborted or hook was stopped
      if (controller.signal.aborted || stoppedRef.current) return;

      setData(result);
      setError(null);

      // Track and detect transition from "had live games" to "no live games"
      if (result.has_live_games) hadLiveRef.current = true;
      if (!result.has_live_games && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        stoppedRef.current = true;
        if (hadLiveRef.current) {
          onAllSettledRef.current?.();
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch live stats");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [cardId]);

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
      abortRef.current?.abort();
      abortRef.current = null;
      stoppedRef.current = true;
    };
  }, [enabled, fetchLive]);

  return { data, isLoading, error, cardResolved: data?.card_resolved ?? false };
}
