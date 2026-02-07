"use client";

import type { StatCategory } from "@/lib/supabase/types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import { useCardBuilder } from "@/lib/cards/card-builder-context";

interface PropLineProps {
  propId: string;
  gameId: string;
  playerName: string;
  statCategory: StatCategory;
  line: number;
}

export default function PropLine({
  propId,
  gameId,
  playerName,
  statCategory,
  line,
}: PropLineProps) {
  const { addPick, removePick, isPickSelected, getSelection, isFull } =
    useCardBuilder();

  const selected = isPickSelected(propId);
  const selection = getSelection(propId);

  function handleClick(side: "over" | "under") {
    if (selected && selection === side) {
      removePick(propId);
    } else if (selected) {
      // Switch selection
      removePick(propId);
      addPick({
        prop_id: propId,
        player_name: playerName,
        stat_category: statCategory,
        line,
        selection: side,
        game_id: gameId,
      });
    } else {
      addPick({
        prop_id: propId,
        player_name: playerName,
        stat_category: statCategory,
        line,
        selection: side,
        game_id: gameId,
      });
    }
  }

  const disabledUnselected = isFull && !selected;

  return (
    <div className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{playerName}</span>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[statCategory]}`}
        >
          {CATEGORY_LABELS[statCategory]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">{line}</span>
        <div className="flex gap-1">
          <button
            onClick={() => handleClick("over")}
            disabled={disabledUnselected}
            className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
              selected && selection === "over"
                ? "border-green-500 bg-green-500/20 text-green-400"
                : disabledUnselected
                  ? "cursor-not-allowed border-border/50 text-muted/50"
                  : "border-border text-muted hover:border-green-500/50 hover:text-green-400"
            }`}
          >
            Over
          </button>
          <button
            onClick={() => handleClick("under")}
            disabled={disabledUnselected}
            className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
              selected && selection === "under"
                ? "border-red-500 bg-red-500/20 text-red-400"
                : disabledUnselected
                  ? "cursor-not-allowed border-border/50 text-muted/50"
                  : "border-border text-muted hover:border-red-500/50 hover:text-red-400"
            }`}
          >
            Under
          </button>
        </div>
      </div>
    </div>
  );
}
