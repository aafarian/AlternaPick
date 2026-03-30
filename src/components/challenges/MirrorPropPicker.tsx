"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { Game, Prop, StatCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Shuffle, Check } from "lucide-react";
import { MIN_CARD_SIZE } from "@/lib/modes";

interface MirrorPropPickerProps {
  maxPicks: number;
  selectedPropIds: string[];
  onSelectionChange: (propIds: string[]) => void;
}

type GameWithProps = Game & { props: Prop[] };

export default function MirrorPropPicker({
  maxPicks,
  selectedPropIds,
  onSelectionChange,
}: MirrorPropPickerProps) {
  const [games, setGames] = useState<GameWithProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/props");
      if (!res.ok) throw new Error("Failed to load props");
      const data = await res.json();
      setGames(data.games ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load props");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProps();
  }, [fetchProps]);

  const allProps = games.flatMap((g) => g.props);

  const toggleProp = (propId: string) => {
    if (selectedPropIds.includes(propId)) {
      onSelectionChange(selectedPropIds.filter((id) => id !== propId));
    } else if (selectedPropIds.length < maxPicks) {
      onSelectionChange([...selectedPropIds, propId]);
    }
  };

  const handleRandom = () => {
    if (allProps.length < MIN_CARD_SIZE) return;
    const count = Math.min(allProps.length, maxPicks);
    const shuffled = [...allProps].sort(() => Math.random() - 0.5);
    onSelectionChange(shuffled.slice(0, count).map((p) => p.id));
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
        <Button variant="link" size="sm" onClick={fetchProps} className="ml-2 text-destructive underline">
          Retry
        </Button>
      </div>
    );
  }

  if (allProps.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No props available for today&apos;s games. Check back later!
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with count and random button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Select{" "}
          <span className="font-bold text-foreground">2–{maxPicks}</span> props
          for the mirror challenge
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRandom}
          disabled={allProps.length < MIN_CARD_SIZE}
          className="gap-1.5 text-xs"
        >
          <Shuffle className="h-3.5 w-3.5" />
          Random
        </Button>
      </div>

      {/* Selection counter */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: maxPicks }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-6 rounded-full transition-colors",
                i < selectedPropIds.length
                  ? "bg-primary"
                  : "bg-secondary"
              )}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {selectedPropIds.length}/{maxPicks}
        </span>
      </div>

      {/* Props list grouped by game */}
      <ScrollArea className="h-56">
        <div className="flex flex-col gap-4 pr-2">
          {games.map((game) => {
            if (game.props.length === 0) return null;
            return (
              <div key={game.id} className="flex flex-col gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {game.away_team} @ {game.home_team}
                </p>
                <div className="flex flex-col gap-1">
                  {game.props.map((prop) => {
                    const isSelected = selectedPropIds.includes(prop.id);
                    const atMax = selectedPropIds.length >= maxPicks;
                    const catLabel =
                      CATEGORY_LABELS[prop.stat_category as StatCategory] ??
                      prop.stat_category;
                    const catColor =
                      CATEGORY_COLORS[prop.stat_category as StatCategory] ?? "";

                    return (
                      <button
                        key={prop.id}
                        onClick={() => toggleProp(prop.id)}
                        disabled={!isSelected && atMax}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : atMax
                              ? "cursor-not-allowed border-transparent opacity-40"
                              : "border-transparent hover:bg-secondary"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="text-sm font-medium">
                            {prop.player_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px]", catColor)}
                          >
                            {catLabel}
                          </Badge>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-muted-foreground">
                          {prop.line}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
