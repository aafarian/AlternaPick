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

function readSaved(storageKey: string): SavedState | null {
  if (typeof window === "undefined") return null;
  if (!storageKey) return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
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

function clearSaved(storageKey: string): void {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // best-effort
  }
}

export function useScrollPaginationRestoration(storageKey: string) {
  // Read the saved state once on mount. We do NOT clear it here because
  // React Strict Mode (default in Next.js dev) double-mounts components:
  // a read-and-clear in the lazy initialiser would consume the state on
  // the first mount and leave the second mount with nothing. Instead we
  // clear the state after restoreScroll() has fired, signalling that the
  // consumer has successfully used it.
  const [savedState] = useState<SavedState | null>(() => readSaved(storageKey));

  // Track the latest offset via a ref so unmount cleanup captures the
  // correct value without depending on it (which would re-run the effect).
  const offsetRef = useRef(0);
  const recordOffset = useCallback((offset: number) => {
    offsetRef.current = offset;
  }, []);

  // Track the latest known scroll position via a ref. We do NOT read
  // window.scrollY at unmount time because Next.js can scroll to top of
  // the new page before our cleanup runs — capturing 0 instead of the
  // user's actual position. Listen to scroll events and remember the
  // last-seen Y so the cleanup uses the right value.
  const scrollYRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    scrollYRef.current = window.scrollY;
    const handler = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Save state on unmount (= navigation away within the SPA).
  // Also save in `pagehide` so iOS bfcache + tab close paths capture it.
  useEffect(() => {
    if (!storageKey) return;

    const persist = () => {
      if (typeof window === "undefined") return;
      // Don't save if there's nothing to restore yet
      if (offsetRef.current === 0) return;
      try {
        const state: SavedState = {
          scrollY: scrollYRef.current,
          offset: offsetRef.current,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // sessionStorage may be full or unavailable — best-effort
      }
    };

    window.addEventListener("pagehide", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [storageKey]);

  // Restore scroll once the caller signals they've rendered enough items.
  // We use requestAnimationFrame to wait for the next paint so layout is
  // settled before we scroll. Clears the saved state after restoring so a
  // subsequent navigation cycle reads fresh.
  const restoredRef = useRef(false);
  const restoreScroll = useCallback(() => {
    if (restoredRef.current || !savedState) return;
    restoredRef.current = true;
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedState.scrollY, behavior: "instant" as ScrollBehavior });
    });
    clearSaved(storageKey);
  }, [savedState, storageKey]);

  return {
    /** The saved offset (item count) from the previous visit, if any. */
    savedOffset: savedState?.offset ?? null,
    /** Call this whenever the loaded item count changes. */
    recordOffset,
    /** Call this once enough items are rendered to make the saved scroll Y meaningful. */
    restoreScroll,
  };
}
