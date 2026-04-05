"use client";

import type { CardHistoryItem } from "@/lib/analytics/types";
import { GAME_MODES } from "@/lib/modes/definitions";
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

export default function CardHistoryModal({
  cards,
  totalCards,
  isAllMode,
}: CardHistoryModalProps) {
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
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
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
                  <p
                    className={`text-lg font-black tabular-nums ${scoreColorClass(card.score, card.totalPicks)}`}
                  >
                    {card.score}/{card.totalPicks}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
