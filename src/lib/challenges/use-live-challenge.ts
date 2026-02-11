"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveChallengeData } from "@/lib/cards/live-types";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export function useLiveChallenge(challengeId: string, enabled: boolean) {
  const [data, setData] = useState<LiveChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const fetchLive = useCallback(async () => {
    if (stoppedRef.current) return;

    setIsLoading((prev) => (!prev && prev === false ? true : prev));
    try {
      const response = await fetch(`/api/challenges/${challengeId}/live`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result: LiveChallengeData = await response.json();
      setData(result);
      setError(null);

      if (!result.has_live_games && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        stoppedRef.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch live stats");
    } finally {
      setIsLoading(false);
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
      stoppedRef.current = true;
    };
  }, [enabled, fetchLive]);

  return { data, isLoading, error };
}
