"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// useAdminFetch — generic data-fetching hook for admin pages
// ---------------------------------------------------------------------------

interface UseAdminFetchReturn<T> {
  /** Fetched data, or null if not yet loaded / errored. */
  data: T | null;
  /** True only on the *initial* load (data has never been fetched). */
  loading: boolean;
  /** Error message, or null if no error. */
  error: string | null;
  /** Trigger a background refresh. Keeps showing stale data while loading. */
  refresh: () => void;
  /** True when a subsequent (non-initial) fetch is in flight. */
  isRefreshing: boolean;
}

/**
 * Fetches JSON from `url` and manages loading / error / data state.
 *
 * - Pass `url = null` to skip fetching (useful for conditional fetches).
 * - Uses `AbortController` so in-flight requests are cancelled on unmount
 *   or when the URL changes.
 * - Distinguishes initial load (`loading = true`) from background refresh
 *   (`isRefreshing = true`) so the UI can keep showing stale data during
 *   refreshes.
 */
export function useAdminFetch<T>(url: string | null): UseAdminFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track whether we've successfully fetched at least once
  const hasFetchedRef = useRef(false);
  // Track latest AbortController so we can cancel on cleanup
  const abortRef = useRef<AbortController | null>(null);
  // Track the current URL to detect stale responses
  const urlRef = useRef(url);
  urlRef.current = url;

  const doFetch = useCallback(
    async (isInitial: boolean) => {
      if (!url) return;

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (isInitial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const res = await fetch(url, { signal: controller.signal });

        // Guard against stale responses (URL changed while request was in flight)
        if (url !== urlRef.current) return;

        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? "You do not have permission to view this data."
              : `Request failed (${res.status})`
          );
        }

        const json: T = await res.json();

        // Guard again after async .json() parse
        if (url !== urlRef.current) return;

        setData(json);
        hasFetchedRef.current = true;
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Guard against stale errors
        if (url !== urlRef.current) return;

        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        if (url === urlRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [url]
  );

  // Initial fetch + refetch when URL changes
  useEffect(() => {
    if (url === null) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    hasFetchedRef.current = false;
    doFetch(true);

    return () => {
      abortRef.current?.abort();
    };
  }, [url, doFetch]);

  // Public refresh function — always treated as a background refresh
  const refresh = useCallback(() => {
    doFetch(false);
  }, [doFetch]);

  return { data, loading, error, refresh, isRefreshing };
}
