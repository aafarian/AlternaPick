"use client";

import type { StatCategory } from "@/lib/supabase/types";
import { useCardBuilder } from "@/lib/cards/card-builder-context";

const CATEGORY_LABELS: Record<StatCategory, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  threes: "3PM",
  blocks: "BLK",
  steals: "STL",
  turnovers: "TO",
  pra: "PRA",
  pts_reb: "P+R",
  pts_ast: "P+A",
  reb_ast: "R+A",
  blk_stl: "B+S",
};

const CATEGORY_COLORS: Record<StatCategory, string> = {
  points: "bg-orange-500/20 text-orange-400",
  rebounds: "bg-blue-500/20 text-blue-400",
  assists: "bg-green-500/20 text-green-400",
  threes: "bg-purple-500/20 text-purple-400",
  blocks: "bg-red-500/20 text-red-400",
  steals: "bg-yellow-500/20 text-yellow-400",
  turnovers: "bg-gray-500/20 text-gray-400",
  pra: "bg-pink-500/20 text-pink-400",
  pts_reb: "bg-teal-500/20 text-teal-400",
  pts_ast: "bg-lime-500/20 text-lime-400",
  reb_ast: "bg-cyan-500/20 text-cyan-400",
  blk_stl: "bg-rose-500/20 text-rose-400",
};

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
