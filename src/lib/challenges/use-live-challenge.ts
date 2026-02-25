"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveChallengeData } from "@/lib/cards/live-types";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export function useLiveChallenge(challengeId: string, enabled: boolean) {
  const [data, setData] = useState<LiveChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  const fetchLive = useCallback(async () => {
    if (stoppedRef.current) return;

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

      if (!result.has_live_games && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        stoppedRef.current = true;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch live stats");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [challengeId]);

  useEffect(() => {
    if (!enabled) return;

    stoppedRef.current = false;
    fetchLive();

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

  return { data, isLoading, error, challengeResolved: data?.challenge_resolved ?? false };
}
