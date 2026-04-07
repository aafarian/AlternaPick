"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import type { CardHistoryItem } from "@/lib/analytics/types";
import type { CardDetailResponse, CardDetailPick } from "@/lib/cards/detail-types";
import { GAME_MODES } from "@/lib/modes/definitions";
import { logWarn } from "@/lib/logger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CardHistoryModalProps {
  cards: CardHistoryItem[];
  totalCards: number;
  isAllMode: boolean;
}

interface DetailState {
  loading: boolean;
  data: CardDetailResponse | null;
  error: string | null;
}

function formatCardDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function scoreColorClass(score: number, total: number): string {
  if (total === 0) return "text-electric-blue";
  const pct = score / total;
  if (pct >= 0.6) return "text-neon-green";
  if (pct < 0.4) return "text-bold-red";
  return "text-electric-blue";
}

function pickResultClass(result: string): string {
  if (result === "hit") return "text-neon-green";
  if (result === "miss") return "text-bold-red";
  return "text-muted-foreground";
}

function PickRow({ pick }: { pick: CardDetailPick }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border/50 py-2 text-xs first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-medium text-foreground">{pick.playerName}</p>
        <p className="truncate text-muted-foreground">
          {pick.selection.toUpperCase()} {pick.line} {pick.statCategory}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className={`font-bold uppercase ${pickResultClass(pick.result)}`}>
          {pick.result}
        </span>
        {pick.actualValue !== null && (
          <span className="tabular-nums text-muted-foreground">
            actual: {pick.actualValue}
          </span>
        )}
      </div>
    </div>
  );
}

function CardRow({
  card,
  isAllMode,
  expanded,
  detail,
  onToggle,
}: {
  card: CardHistoryItem;
  isAllMode: boolean;
  expanded: boolean;
  detail: DetailState | undefined;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              {formatCardDate(card.resolvedAt)}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {card.cardSize}-Pick
              </Badge>
              {isAllMode && (
                <Badge variant="outline" className="text-xs">
                  {GAME_MODES[card.gameMode].displayName}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <p
          className={`text-lg font-black tabular-nums ${scoreColorClass(card.score, card.totalPicks)}`}
        >
          {card.score}/{card.totalPicks}
        </p>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2">
          {detail?.loading && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading picks...
            </div>
          )}
          {detail?.error && (
            <p className="py-2 text-xs text-bold-red">{detail.error}</p>
          )}
          {detail?.data && (
            <>
              <div className="flex flex-col">
                {detail.data.picks.map((pick) => (
                  <PickRow key={pick.id} pick={pick} />
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/cards/${card.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View card
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CardHistoryModal({
  cards,
  totalCards,
  isAllMode,
}: CardHistoryModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  const fetchDetail = useCallback(async (cardId: string) => {
    setDetails((prev) => ({
      ...prev,
      [cardId]: { loading: true, data: null, error: null },
    }));
    try {
      const res = await fetch(`/api/cards/${cardId}`);
      if (!res.ok) {
        throw new Error(`Failed to load card (${res.status})`);
      }
      const data = (await res.json()) as CardDetailResponse;
      setDetails((prev) => ({
        ...prev,
        [cardId]: { loading: false, data, error: null },
      }));
    } catch (err) {
      logWarn("card-history-modal", "Failed to fetch card detail", err);
      setDetails((prev) => ({
        ...prev,
        [cardId]: {
          loading: false,
          data: null,
          error: err instanceof Error ? err.message : "Failed to load card",
        },
      }));
    }
  }, []);

  const toggleCard = useCallback(
    (cardId: string) => {
      if (expandedId === cardId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(cardId);
      if (!details[cardId]) {
        fetchDetail(cardId);
      }
    },
    [expandedId, details, fetchDetail],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer border-primary/20 bg-primary/5 transition-colors hover:bg-primary/10">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total Cards
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              {totalCards}
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Card History{" "}
            <span className="text-muted-foreground font-normal">
              ({totalCards})
            </span>
          </DialogTitle>
        </DialogHeader>
        {cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No resolved cards yet.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-2 pr-3">
              {cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  isAllMode={isAllMode}
                  expanded={expandedId === card.id}
                  detail={details[card.id]}
                  onToggle={() => toggleCard(card.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
