"use client";

import { useState, useCallback } from "react";
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
}

export default function CardListWithLoadMore({
  initialCards,
  statusFilter,
  pageSize = 20,
  hasMoreInitially = true,
}: CardListWithLoadMoreProps) {
  const [cards, setCards] = useState<CardWithPicks[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    hasMoreInitially && initialCards.length >= pageSize
      ? initialCards[initialCards.length - 1]?.created_at ?? null
      : null
  );

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

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <AnimatedList className="flex flex-col gap-4" staggerDelay={0.05}>
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
