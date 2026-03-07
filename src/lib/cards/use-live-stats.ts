"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveCardData } from "./live-types";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/lib/constants";
import { schedulePollingConfirmation } from "@/lib/polling/schedule-confirmation";

export function useLiveStats(cardId: string, enabled: boolean, onAllSettled?: () => void) {
  const [data, setData] = useState<LiveCardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmAbortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef(0);

  // Keep onAllSettled in a ref so the fetch callback doesn't depend on it
  const onAllSettledRef = useRef(onAllSettled);
  onAllSettledRef.current = onAllSettled;

  const stopPolling = useCallback(() => {
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
  }, []);

  const fetchLive = useCallback(async () => {
    if (stoppedRef.current) return;

    // 6-hour hard timeout — stop polling no matter what
    if (Date.now() - startTimeRef.current > POLL_TIMEOUT_MS) {
      stopPolling();
      return;
    }

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

      // Only stop when the server confirms ALL games are final.
      // Use a confirmation re-fetch to guard against transient false positives.
      if (result.all_games_final && intervalRef.current) {
        schedulePollingConfirmation({
          url: `/api/cards/${cardId}/live`,
          intervalRef,
          confirmTimeoutRef,
          confirmAbortRef,
          stoppedRef,
          isStillAllFinal: (json) => (json as LiveCardData).all_games_final,
          onData: (json) => setData(json as LiveCardData),
          stopPolling,
          resumePolling: () => {
            intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
          },
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch live stats");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [cardId, stopPolling]);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;
    startTimeRef.current = Date.now();

    // Fetch immediately
    fetchLive();

    // Set up polling
    intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);

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
  }, [enabled, fetchLive]);

  return { data, isLoading, error, cardResolved: data?.card_resolved ?? false };
}
