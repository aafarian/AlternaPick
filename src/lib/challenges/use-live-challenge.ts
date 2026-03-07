"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveChallengeData } from "@/lib/cards/live-types";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "@/lib/constants";

export function useLiveChallenge(challengeId: string, enabled: boolean) {
  const [data, setData] = useState<LiveChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmAbortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef(0);

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
      const response = await fetch(`/api/challenges/${challengeId}/live`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result: LiveChallengeData = await response.json();

      // Don't update state if this request was aborted or hook was stopped
      if (controller.signal.aborted || stoppedRef.current) return;

      setData(result);
      setError(null);

      // Only stop when the server confirms ALL games are final.
      // Use a confirmation re-fetch to guard against transient false positives.
      if (result.all_games_final && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;

        if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        confirmAbortRef.current?.abort();
        confirmTimeoutRef.current = setTimeout(async () => {
          confirmTimeoutRef.current = null;
          if (stoppedRef.current) return;
          const confirmController = new AbortController();
          confirmAbortRef.current = confirmController;
          try {
            const res = await fetch(`/api/challenges/${challengeId}/live`, {
              signal: confirmController.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json: LiveChallengeData = await res.json();
            if (stoppedRef.current) return;
            setData(json);
            if (json.all_games_final) {
              stopPolling();
            } else {
              // Not actually final — resume polling
              intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
            }
          } catch (confirmErr) {
            if ((confirmErr as Error).name === "AbortError") return;
            // Confirmation failed — resume polling instead of stopping
            if (!stoppedRef.current) {
              intervalRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
            }
          }
        }, 5000);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch live stats");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [challengeId, stopPolling]);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;
    startTimeRef.current = Date.now();

    fetchLive();

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

  return { data, isLoading, error, challengeResolved: data?.challenge_resolved ?? false };
}
