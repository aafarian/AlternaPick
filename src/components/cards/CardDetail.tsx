"use client";

import type { CardWithPicks } from "@/lib/cards/api";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { StatCategory } from "@/lib/supabase/types";

interface CardDetailProps {
  card: CardWithPicks;
}

function StatusBadge({ status, score, total }: { status: string; score: number; total: number }) {
  if (status === "locked") {
    return (
      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
        Locked
      </span>
    );
  }

  const isGoodScore = score >= total / 2;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isGoodScore
          ? "bg-green-500/20 text-green-400"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      Resolved
    </span>
  );
}

function ScoreDisplay({ score, total, status }: { score: number; total: number; status: string }) {
  if (status !== "resolved") {
    return <span className="text-sm text-muted">Pending</span>;
  }

  const isGoodScore = score >= total / 2;
  return (
    <span
      className={`text-lg font-bold ${
        isGoodScore ? "text-green-400" : "text-red-400"
      }`}
    >
      {score}/{total}
    </span>
  );
}

function ResultIcon({ result }: { result: string }) {
  switch (result) {
    case "hit":
      return <span className="text-green-400">✓</span>;
    case "miss":
      return <span className="text-red-400">✗</span>;
    default:
      return <span className="text-amber-400">⏳</span>;
  }
}

export default function CardDetail({ card }: CardDetailProps) {
  const date = new Date(card.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl border border-border bg-surface">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={card.status} score={card.score} total={card.total_picks} />
          <span className="text-sm text-muted">{date}</span>
        </div>
        <ScoreDisplay score={card.score} total={card.total_picks} status={card.status} />
      </div>

      {/* Picks */}
      <div className="flex flex-col gap-1 p-2">
        {card.picks.map((pick) => {
          const statCat = (pick.props?.stat_category ?? "points") as StatCategory;
          return (
            <div
              key={pick.id}
              className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <ResultIcon result={pick.result} />
                <span className="text-sm font-medium">
                  {pick.props?.player_name ?? "Unknown"}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    CATEGORY_COLORS[statCat] ?? ""
                  }`}
                >
                  {CATEGORY_LABELS[statCat] ?? statCat}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{pick.props?.line ?? "—"}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    pick.selection === "over"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {pick.selection === "over" ? "Over" : "Under"}
                </span>
                {pick.actual_value !== null && (
                  <span className="text-sm text-muted">
                    Actual: {pick.actual_value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
