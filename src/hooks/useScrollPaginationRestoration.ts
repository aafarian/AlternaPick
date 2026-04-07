"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Persists scroll position + pagination offset across navigation so that
 * pressing "back" from a detail page returns the user to exactly where they
 * were in a long list (e.g. /picks history, /challenges completed list).
 *
 * Usage:
 * ```ts
 * const { savedOffset, recordOffset, restoreScroll } =
 *   useScrollPaginationRestoration("picks-resolved");
 *
 * // 1. After mount, fast-forward pagination to savedOffset (if any)
 * useEffect(() => {
 *   if (savedOffset && savedOffset > items.length) {
 *     loadUpTo(savedOffset);
 *   }
 * }, [savedOffset]);
 *
 * // 2. Track the current loaded count so we can save it on unmount
 * useEffect(() => { recordOffset(items.length); }, [items.length, recordOffset]);
 *
 * // 3. Restore scroll once enough items are rendered to reach the saved Y
 * useEffect(() => {
 *   if (items.length >= (savedOffset ?? 0)) restoreScroll();
 * }, [items.length, savedOffset, restoreScroll]);
 * ```
 *
 * State is keyed by `storageKey` so different lists don't trample each other.
 * The state is consumed exactly once (read-and-clear on mount) so a fresh
 * page load (refresh, new tab) doesn't apply stale restoration.
 *
 * Save policy:
 * - On unmount (navigation away within the SPA)
 * - Captures `window.scrollY` and the current offset at that moment
 *
 * Cap policy:
 * - Restoration is bounded to MAX_RESTORE_ITEMS to avoid pathological refetch
 *   (a user with 50 pages loaded would otherwise re-fetch all 50 on back).
 */

interface SavedState {
  scrollY: number;
  offset: number;
}

const MAX_RESTORE_ITEMS = 200;

function readAndClear(storageKey: string): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    sessionStorage.removeItem(storageKey);
    const parsed = JSON.parse(raw) as SavedState;
    if (
      typeof parsed?.scrollY !== "number" ||
      typeof parsed?.offset !== "number"
    ) {
      return null;
    }
    // Cap restoration to avoid mass-refetch on back navigation
    if (parsed.offset > MAX_RESTORE_ITEMS) {
      parsed.offset = MAX_RESTORE_ITEMS;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useScrollPaginationRestoration(storageKey: string) {
  // Read saved state once on mount and clear it (one-shot).
  // Lazy initialiser so it runs after hydration when sessionStorage exists.
  const [savedState] = useState<SavedState | null>(() => readAndClear(storageKey));

  // Track the latest offset via a ref so unmount cleanup captures the
  // correct value without depending on it (which would re-run the effect).
  const offsetRef = useRef(0);
  const recordOffset = useCallback((offset: number) => {
    offsetRef.current = offset;
  }, []);

  // Save state on unmount (= navigation away within the SPA).
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      // Don't save if there's nothing to restore yet
      if (offsetRef.current === 0) return;
      try {
        const state: SavedState = {
          scrollY: window.scrollY,
          offset: offsetRef.current,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // sessionStorage may be full or unavailable — best-effort
      }
    };
  }, [storageKey]);

  // Restore scroll once the caller signals they've rendered enough items.
  // We use requestAnimationFrame to wait for the next paint so layout is
  // settled before we scroll.
  const restoredRef = useRef(false);
  const restoreScroll = useCallback(() => {
    if (restoredRef.current || !savedState) return;
    restoredRef.current = true;
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedState.scrollY, behavior: "instant" as ScrollBehavior });
    });
  }, [savedState]);

  return {
    /** The saved offset (item count) from the previous visit, if any. */
    savedOffset: savedState?.offset ?? null,
    /** Call this whenever the loaded item count changes. */
    recordOffset,
    /** Call this once enough items are rendered to make the saved scroll Y meaningful. */
    restoreScroll,
  };
}
