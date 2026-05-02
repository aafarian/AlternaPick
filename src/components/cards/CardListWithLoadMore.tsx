"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import CardDetail from "@/components/cards/CardDetail";
import { Button } from "@/components/ui/button";
import { AnimatedList } from "@/components/motion";
import type { CardWithPicks } from "@/lib/cards/api";

interface CardListWithLoadMoreProps {
  initialCards: CardWithPicks[];
  /** Filter cards by status on load-more requests (e.g. "resolved", "locked") */
  statusFilter?: string;
  /** How many cards to load per page */
  pageSize?: number;
  /** Whether the initial batch might be a full page (and thus there may be more) */
  hasMoreInitially?: boolean;
  /**
   * If set, the loaded card count and scroll Y are persisted to sessionStorage
   * keyed by this string. On remount (browser back from a detail page), the
   * component fast-forwards pagination to match and restores scroll position.
   * Leave undefined to disable.
   */
  restorationKey?: string;
}

const MAX_RESTORE_ITEMS = 200;

interface SavedState {
  scrollY: number;
  count: number;
}

function readSaved(key: string): SavedState | null {
  if (typeof window === "undefined" || !key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (typeof parsed?.scrollY !== "number" || typeof parsed?.count !== "number") {
      return null;
    }
    if (parsed.count > MAX_RESTORE_ITEMS) parsed.count = MAX_RESTORE_ITEMS;
    return parsed;
  } catch {
    return null;
  }
}

export default function CardListWithLoadMore({
  initialCards,
  statusFilter,
  pageSize = 20,
  hasMoreInitially = true,
  restorationKey,
}: CardListWithLoadMoreProps) {
  const [cards, setCards] = useState<CardWithPicks[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    hasMoreInitially && initialCards.length >= pageSize
      ? initialCards[initialCards.length - 1]?.created_at ?? null
      : null
  );

  // Read saved state on mount (one-shot per mount; we don't clear so Strict
  // Mode's double-mount in dev still sees the same value)
  const savedRef = useRef<SavedState | null>(restorationKey ? readSaved(restorationKey) : null);

  const cardsCountRef = useRef(cards.length);
  useEffect(() => { cardsCountRef.current = cards.length; }, [cards.length]);

  // Continuously save state to sessionStorage on every scroll, gated by an
  // isNavigating flag that flips to true on the FIRST anchor click. After
  // that we ignore scroll events (because Next.js scrolls the new page to
  // top before our cleanup runs, which would otherwise clobber the saved Y
  // with 0).
  const isNavigatingRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !restorationKey) return;
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("a[href]")) {
        isNavigatingRef.current = true;
      }
    };
    document.addEventListener("click", onClickCapture, { capture: true });
    return () => {
      document.removeEventListener("click", onClickCapture, { capture: true } as EventListenerOptions);
    };
  }, [restorationKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !restorationKey) return;
    const save = () => {
      if (isNavigatingRef.current) return;
      if (cardsCountRef.current <= pageSize) return;
      try {
        sessionStorage.setItem(
          restorationKey,
          JSON.stringify({
            scrollY: window.scrollY,
            count: cardsCountRef.current,
          }),
        );
      } catch {
        // best-effort
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    // Also save once on mount in case the user clicks without scrolling
    save();
    return () => window.removeEventListener("scroll", save);
  }, [restorationKey, pageSize]);

  // Also save whenever the loaded count changes (Load More click)
  useEffect(() => {
    if (typeof window === "undefined" || !restorationKey) return;
    if (isNavigatingRef.current) return;
    if (cards.length <= pageSize) return;
    try {
      sessionStorage.setItem(
        restorationKey,
        JSON.stringify({
          scrollY: window.scrollY,
          count: cards.length,
        }),
      );
    } catch {
      // best-effort
    }
  }, [cards.length, restorationKey, pageSize]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        cursor: nextCursor,
      });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      const newCards: CardWithPicks[] = data.cards ?? [];

      setCards((prev) => [...prev, ...newCards]);
      setNextCursor(data.next_cursor ?? null);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, [nextCursor, pageSize, statusFilter]);

  // Fast-forward pagination on mount if a saved count exists and the
  // current cards array doesn't already have enough. Tracks count locally
  // inside the loop to avoid stale-ref issues with React batching.
  const fastForwardedRef = useRef(false);
  useEffect(() => {
    if (!restorationKey || fastForwardedRef.current) return;
    const saved = savedRef.current;
    if (!saved) return;
    fastForwardedRef.current = true;

    if (cards.length >= saved.count) return; // already enough — nothing to fetch

    let cancelled = false;
    (async () => {
      let cursor: string | null =
        cards.length > 0 ? cards[cards.length - 1]?.created_at ?? null : null;
      let localCount = cards.length;
      while (!cancelled && cursor && localCount < saved.count) {
        const params = new URLSearchParams({
          limit: String(pageSize),
          cursor,
        });
        if (statusFilter) params.set("status", statusFilter);
        try {
          const res = await fetch(`/api/cards?${params}`);
          if (!res.ok) break;
          const data = await res.json();
          const newCards: CardWithPicks[] = data.cards ?? [];
          if (newCards.length === 0) break;
          setCards((prev) => [...prev, ...newCards]);
          localCount += newCards.length;
          cursor = data.next_cursor ?? null;
          setNextCursor(cursor);
        } catch {
          break;
        }
      }
    })();

    return () => { cancelled = true; };
    // Run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore scroll once the loaded count matches the saved count. This is a
  // separate effect so it fires whether the fast-forward had work to do or
  // not (i.e. when the React tree is preserved across navigation, no fetch
  // is needed but we still want to restore Y).
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current || !restorationKey) return;
    const saved = savedRef.current;
    if (!saved) return;
    if (cards.length < saved.count) return;
    scrollRestoredRef.current = true;
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY, behavior: "instant" as ScrollBehavior });
    });
  }, [cards.length, restorationKey]);

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <AnimatedList className="grid grid-cols-1 gap-4" staggerDelay={0.05}>
        {cards.map((card) => (
          <div key={card.id} className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 rounded-xl">
            <CardDetail card={card} />
          </div>
        ))}
      </AnimatedList>
      {nextCursor && (
        <Button
          onClick={loadMore}
          disabled={loading}
          variant="outline"
          className="self-center"
        >
          {loading ? "Loading..." : "Load More"}
        </Button>
      )}
    </div>
  );
}
