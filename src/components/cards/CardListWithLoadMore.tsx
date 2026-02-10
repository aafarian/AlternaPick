"use client";

import { useState, useCallback } from "react";
import CardDetail from "@/components/cards/CardDetail";
import { Button } from "@/components/ui/button";
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
  pageSize = 10,
  hasMoreInitially = true,
}: CardListWithLoadMoreProps) {
  const [cards, setCards] = useState<CardWithPicks[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(
    hasMoreInitially && initialCards.length >= pageSize
  );

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(cards.length),
      });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      const newCards: CardWithPicks[] = data.cards ?? [];

      setCards((prev) => [...prev, ...newCards]);
      if (newCards.length < pageSize) {
        setHasMore(false);
      }
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, [cards.length, pageSize, statusFilter]);

  if (cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {cards.map((card) => (
        <CardDetail key={card.id} card={card} />
      ))}
      {hasMore && (
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
