"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  usePlayerProfile,
} from "@/lib/players/player-profile-context";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  shortenTeamName,
} from "@/lib/constants";
import { SPORT_LABELS, getPlayerHeadshotUrl, isValidSport } from "@/lib/sports";
import type { StatCategory } from "@/lib/supabase/types";
import type { GameLogEntry, SeasonAverages } from "@/lib/stats-service/client";
import { getCompositeValue, getGamelogFieldsForCategory } from "@/lib/players/stat-mapping";

/** Which column in the game log a stat category maps to for highlighting. */
function getHighlightColumn(cat: StatCategory): string | null {
  const map: Partial<Record<StatCategory, string>> = {
    points: "PTS",
    rebounds: "REB",
    assists: "AST",
    threes: "3PM",
    blocks: "BLK",
    steals: "STL",
    turnovers: "TO",
  };
  return map[cat] ?? null;
}

// Column definitions for the compact game log
const COLUMNS = [
  { key: "date", label: "DATE", width: "w-16" },
  { key: "opp", label: "OPP", width: "w-14" },
  { key: "MIN", label: "MIN", width: "w-10", field: "minutes" as const },
  { key: "PTS", label: "PTS", width: "w-10", field: "points" as const },
  { key: "REB", label: "REB", width: "w-10", field: "rebounds" as const },
  { key: "AST", label: "AST", width: "w-10", field: "assists" as const },
  { key: "3PM", label: "3PM", width: "w-10", field: "threes_made" as const },
] as const;

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  // Handle various date formats
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Try to extract from "JAN 15, 2025" style
    return dateStr.slice(0, 6);
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function extractOpponent(matchup: string): string {
  // "LAL vs. BOS" or "@ BOS" or "vs BOS"
  const parts = matchup.split(/\s+(?:vs\.?|@)\s+/i);
  if (parts.length >= 2) return parts[1].trim().slice(0, 4);
  // Fallback: take last 3-4 chars
  return matchup.slice(-4).trim();
}

// Raw colors for SVG fills
const GREEN = "#00d26a";
const GREEN_DIM = "rgba(0,210,106,0.3)";
const RED = "#ef4444";
const RED_DIM = "rgba(239,68,68,0.25)";
const AXIS_TEXT = "rgba(161,161,170,0.6)";
const LINE_STROKE = "rgba(255,255,255,0.45)";
const FONT = "var(--font-geist-sans), system-ui, sans-serif";

/** SVG bar chart — per-game stat values vs the prop line. */
function PropChart({
  games,
  statCategory,
  line,
}: {
  games: GameLogEntry[];
  statCategory: StatCategory;
  line: number;
}) {
  const chronological = [...games].reverse();
  const values = chronological.map((g) => getCompositeValue(g, statCategory));
  const count = chronological.length;
  if (count === 0) return null;

  const maxVal = Math.max(...values, line, 1);
  const ceiling = Math.ceil(maxVal * 1.3) || 1;

  // Layout — line label sits in the left gutter, everything else is the chart
  const W = 380;
  const labelW = 30;   // left gutter for the line value label only
  const padR = 8;
  const padTop = 18;   // room for value labels above tallest bar
  const padBot = 16;   // room for opponent labels
  const chartH = 100;
  const totalH = padTop + chartH + padBot;

  const chartL = labelW;
  const chartR = W - padR;
  const chartW = chartR - chartL;
  const slotW = chartW / count;
  const barW = Math.min(slotW * 0.5, 36);
  const barR = 3;

  const yOf = (v: number) => padTop + chartH * (1 - v / ceiling);
  const baseY = yOf(0);
  const lineY = yOf(line);

  return (
    <div className="px-4 pb-1">
      <svg
        viewBox={`0 0 ${W} ${totalH}`}
        className="w-full"
        role="img"
        aria-label={`${CATEGORY_LABELS[statCategory]} per game vs line ${line}`}
      >
        {/* Bars + labels */}
        {chronological.map((game, i) => {
          const val = values[i];
          const over = val > line;
          const eq = val === line;
          const barH = Math.max((val / ceiling) * chartH, 2);
          const cx = chartL + slotW * i + slotW / 2;
          const bx = cx - barW / 2;
          const by = baseY - barH;

          return (
            <g key={i}>
              <rect
                x={bx} y={by} width={barW} height={barH}
                rx={barR} ry={barR}
                fill={over ? GREEN_DIM : eq ? "rgba(161,161,170,0.2)" : RED_DIM}
              />
              {/* Value above bar */}
              <text
                x={cx} y={by - 5}
                textAnchor="middle"
                fill={over ? GREEN : eq ? AXIS_TEXT : RED}
                fontSize={11} fontWeight={700} fontFamily={FONT}
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}
              >
                {val}
              </text>
              {/* Opponent below baseline */}
              <text
                x={cx} y={baseY + 13}
                textAnchor="middle"
                fill={AXIS_TEXT}
                fontSize={9} fontWeight={500} fontFamily={FONT}
              >
                {extractOpponent(game.matchup)}
              </text>
            </g>
          );
        })}

        {/* Prop line — dashed */}
        <line
          x1={chartL} x2={chartR}
          y1={lineY} y2={lineY}
          stroke={LINE_STROKE}
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
        {/* Line label — left gutter */}
        <text
          x={labelW - 5} y={lineY + 3.5}
          textAnchor="end"
          fill="rgba(255,255,255,0.7)"
          fontSize={9.5} fontWeight={700} fontFamily={FONT}
        >
          {line}
        </text>
      </svg>
    </div>
  );
}

export default function PlayerProfileSheet() {
  const { target, isOpen, closeProfile } = usePlayerProfile();
  const [games, setGames] = useState<GameLogEntry[]>([]);
  const [averages, setAverages] = useState<SeasonAverages | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target || !isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setGames([]);
    setAverages(null);

    fetch(
      `/api/players/${encodeURIComponent(target.playerId)}/gamelog?sport=${encodeURIComponent(target.sport ?? "nba")}&last_n=5&name=${encodeURIComponent(target.playerName)}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load game log");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const data = json.data ?? {};
        setGames(data.games ?? []);
        setAverages(data.season_averages ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load game log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.playerId, target?.sport, isOpen]);

  function retry() {
    if (!target) return;
    setLoading(true);
    setError(null);

    fetch(
      `/api/players/${encodeURIComponent(target.playerId)}/gamelog?sport=${encodeURIComponent(target.sport ?? "nba")}&last_n=5&name=${encodeURIComponent(target.playerName)}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load game log");
        return res.json();
      })
      .then((json) => {
        const data = json.data ?? {};
        setGames(data.games ?? []);
        setAverages(data.season_averages ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load game log");
      })
      .finally(() => setLoading(false));
  }

  const propCtx = target?.propContext;
  const highlightCol = propCtx ? getHighlightColumn(propCtx.statCategory) : null;
  const hasCompositeHighlight = propCtx
    ? getGamelogFieldsForCategory(propCtx.statCategory).length > 1
    : false;

  const content = (
    <>
      {/* Header */}
      {target && (
        <SheetHeader className="flex-row items-center gap-3 p-4 pb-2">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
            {getPlayerHeadshotUrl(target.playerId, target.sport) ? (
              <Image
                src={getPlayerHeadshotUrl(target.playerId, target.sport)}
                alt={target.playerName}
                width={64}
                height={64}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">
                {target.playerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <SheetTitle className="truncate text-base">
              {target.playerName}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 text-xs">
              {target.playerTeam && (
                <span>{shortenTeamName(target.playerTeam)}</span>
              )}
              {target.playerPosition && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{target.playerPosition}</span>
                </>
              )}
              {target.sport && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[9px]">
                  {isValidSport(target.sport) ? SPORT_LABELS[target.sport] : target.sport.toUpperCase()}
                </Badge>
              )}
            </SheetDescription>
          </div>
        </SheetHeader>
      )}

      {/* Prop context */}
      {propCtx && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="text-lg font-black tabular-nums">{propCtx.line}</span>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs font-semibold",
              CATEGORY_COLORS[propCtx.statCategory]
            )}
          >
            {CATEGORY_LABELS[propCtx.statCategory]}
          </Badge>
        </div>
      )}

      {/* Prop chart — only when opened from a prop card and games loaded */}
      {propCtx && !loading && !error && games.length > 0 && (
        <PropChart
          games={games}
          statCategory={propCtx.statCategory}
          line={propCtx.line}
        />
      )}

      {/* Game log */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[160px] rounded-xl" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={retry} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-1 border-b border-border pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {COLUMNS.map((col) => (
                <span
                  key={col.key}
                  className={cn(
                    col.width,
                    "shrink-0 text-center",
                    col.key === "date" && "text-left",
                    col.key === "opp" && "text-left",
                    highlightCol === col.key && "text-foreground"
                  )}
                >
                  {col.label}
                </span>
              ))}
              {hasCompositeHighlight && (
                <span className="w-10 shrink-0 text-center text-foreground">
                  {CATEGORY_LABELS[propCtx!.statCategory]?.slice(0, 5)}
                </span>
              )}
            </div>

            {/* Game rows */}
            {games.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No game log available
              </p>
            ) : (
              games.map((game, i) => {
                const compositeVal = propCtx
                  ? getCompositeValue(game, propCtx.statCategory)
                  : null;
                const beatsLine =
                  compositeVal !== null && propCtx
                    ? compositeVal > propCtx.line
                    : null;

                return (
                  <div
                    key={i}
                    className="flex items-center gap-1 border-b border-border/50 py-1.5 text-xs tabular-nums"
                  >
                    {COLUMNS.map((col) => {
                      if (col.key === "date") {
                        return (
                          <span key={col.key} className={cn(col.width, "shrink-0 text-left text-muted-foreground")}>
                            {formatDate(game.game_date)}
                          </span>
                        );
                      }
                      if (col.key === "opp") {
                        return (
                          <span key={col.key} className={cn(col.width, "shrink-0 truncate text-left text-muted-foreground")}>
                            {extractOpponent(game.matchup)}
                          </span>
                        );
                      }

                      const val = game[col.field];
                      const isHighlighted = highlightCol === col.key;
                      const valBeatsLine =
                        isHighlighted && propCtx && !hasCompositeHighlight
                          ? (val as number) > propCtx.line
                          : null;

                      return (
                        <span
                          key={col.key}
                          className={cn(
                            col.width,
                            "shrink-0 text-center",
                            isHighlighted && "font-bold",
                            valBeatsLine === true && "text-neon-green",
                            valBeatsLine === false && "text-bold-red"
                          )}
                        >
                          {val}
                        </span>
                      );
                    })}

                    {hasCompositeHighlight && (
                      <span
                        className={cn(
                          "w-10 shrink-0 text-center font-bold",
                          beatsLine === true && "text-neon-green",
                          beatsLine === false && "text-bold-red"
                        )}
                      >
                        {compositeVal}
                      </span>
                    )}
                  </div>
                );
              })
            )}

            {/* Season averages */}
            {averages && averages.games_played > 0 && (
              <div className="mt-1 flex items-center gap-1 border-t border-border pt-2 text-xs tabular-nums">
                <span className="w-16 shrink-0 text-left text-[10px] font-semibold uppercase text-muted-foreground">
                  AVG
                </span>
                <span className="w-14 shrink-0 text-left text-[10px] text-muted-foreground">
                  {averages.games_played}G
                </span>
                <span className={cn("w-10 shrink-0 text-center text-muted-foreground", highlightCol === "MIN" && "font-bold text-foreground")}>
                  {averages.minutes}
                </span>
                <span className={cn("w-10 shrink-0 text-center text-muted-foreground", highlightCol === "PTS" && "font-bold text-foreground")}>
                  {averages.points}
                </span>
                <span className={cn("w-10 shrink-0 text-center text-muted-foreground", highlightCol === "REB" && "font-bold text-foreground")}>
                  {averages.rebounds}
                </span>
                <span className={cn("w-10 shrink-0 text-center text-muted-foreground", highlightCol === "AST" && "font-bold text-foreground")}>
                  {averages.assists}
                </span>
                <span className={cn("w-10 shrink-0 text-center text-muted-foreground", highlightCol === "3PM" && "font-bold text-foreground")}>
                  {averages.threes_made}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeProfile()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn(
          "flex flex-col",
          isDesktop
            ? "w-[420px] sm:max-w-[420px]"
            : "max-h-[85vh] rounded-t-2xl"
        )}
        showCloseButton={isDesktop}
      >
        {/* Drag handle — mobile only */}
        {!isDesktop && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {content}
      </SheetContent>
    </Sheet>
  );
}
