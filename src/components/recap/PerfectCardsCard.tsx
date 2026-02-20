"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { PerfectCards } from "@/lib/recaps/compute";

interface PerfectCardsCardProps {
  data: PerfectCards;
}

export function PerfectCardsCard({ data }: PerfectCardsCardProps) {
  if (data.count === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Perfect Cards</h2>
            <p className="text-xs text-muted-foreground">
              Every single pick was a hit
            </p>
          </div>
          <Badge className="ml-auto shrink-0 text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
            {data.count} card{data.count !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Celebration Content */}
        <div className="mt-4 rounded-lg bg-amber-500/5 px-3 py-3 text-center">
          <p className="text-2xl font-black tabular-nums text-amber-400">
            {data.count}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.count === 1
              ? "1 user hit a perfect card yesterday!"
              : `${data.count} users hit perfect cards yesterday!`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
