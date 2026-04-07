"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import CardDetail from "@/components/cards/CardDetail";
import { Button } from "@/components/ui/button";
import { AnimatedList } from "@/components/motion";
import type { CardWithPicks } from "@/lib/cards/api";
import { useScrollPaginationRestoration } from "@/hooks/useScrollPaginationRestoration";

interface CardListWithLoadMoreProps {
  initialCards: CardWithPicks[];
  /** Filter cards by status on load-more requests (e.g. "resolved", "locked") */
  statusFilter?: string;
  /** How many cards to load per page */
  pageSize?: number;
  /** Whether the initial batch might be a full page (and thus there may be more) */
  hasMoreInitially?: boolean;
  /** Optional sessionStorage key for back-navigation scroll/pagination restoration */
  restorationKey?: string;
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

  const { savedOffset, recordOffset, restoreScroll } =
    useScrollPaginationRestoration(restorationKey ?? "");

  const loadMore = useCallback(async () => {
    if (!nextCursor) return null;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        cursor: nextCursor,
      });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) return null;

      const data = await res.json();
      const newCards: CardWithPicks[] = data.cards ?? [];

      setCards((prev) => [...prev, ...newCards]);
      setNextCursor(data.next_cursor ?? null);
      return data.next_cursor ?? null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [nextCursor, pageSize, statusFilter]);

  // Track loaded count for the unmount-time save
  useEffect(() => {
    recordOffset(cards.length);
  }, [cards.length, recordOffset]);

  // On mount, if a saved offset exists, fast-forward pagination by sequentially
  // fetching pages until we reach it. We track loaded count locally inside the
  // loop because setCards is async — a ref updated via useEffect would still
  // hold the stale value when the next iteration's `while` check runs.
  const restoringRef = useRef(false);
  useEffect(() => {
    if (!restorationKey || !savedOffset || restoringRef.current) return;
    if (cards.length >= savedOffset) return;
    restoringRef.current = true;

    let cancelled = false;
    (async () => {
      let cursor = nextCursor;
      let localCount = cards.length;
      while (!cancelled && cursor && localCount < savedOffset) {
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

    return () => {
      cancelled = true;
    };
    // Intentionally only depends on the saved offset / restoration key — we
    // want this to fire exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOffset, restorationKey]);

  // Restore scroll once enough cards are rendered to reach the saved Y
  useEffect(() => {
    if (savedOffset && cards.length >= savedOffset) {
      restoreScroll();
    }
  }, [cards.length, savedOffset, restoreScroll]);

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
