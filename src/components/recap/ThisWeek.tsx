"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/constants";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Trophy,
  User,
} from "lucide-react";
import { isValidSport, SPORT_CONFIG } from "@/lib/sports/config";
import { WeeklyTrendChart } from "@/components/recap/WeeklyTrendChart";
import type {
  WeeklyRecapData,
  WeeklyPersonalStats,
} from "@/lib/recaps/compute";
import { AnimatedNumber } from "@/components/recap/AnimatedNumber";

interface ThisWeekProps {
  weeklyData: WeeklyRecapData;
  personalWeekly?: WeeklyPersonalStats | null;
}

function hitRateColor(rate: number): string {
  if (rate >= 0.6) return "text-neon-green";
  if (rate >= 0.4) return "text-electric-blue";
  return "text-bold-red";
}

function sportLabel(sport: string): string {
  if (isValidSport(sport)) return SPORT_CONFIG[sport].shortLabel;
  return sport.toUpperCase();
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`;
}

export function ThisWeek({ weeklyData, personalWeekly }: ThisWeekProps) {
  const {
    dailyTrend,
    weeklyHitRate,
    totalPicks,
    totalCards,
    topPlayer,
    worstTrap,
    bestLock,
    startDate,
    endDate,
  } = weeklyData;

  // Guard: if no data at all, don't render
  if (totalPicks === 0 && dailyTrend.length === 0) return null;

  const hitPercent = Math.round(weeklyHitRate * 100);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">This Week</h2>
            <p className="text-xs text-muted-foreground">
              {formatDateRange(startDate, endDate)}
            </p>
          </div>
        </div>

        {/* Trend Chart */}
        {dailyTrend.length > 0 && (
          <div className="mt-4">
            <WeeklyTrendChart data={dailyTrend} />
          </div>
        )}

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {/* Total Picks */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total Picks
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              <AnimatedNumber value={totalPicks} />
            </p>
          </div>

          {/* Total Cards */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total Cards
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              <AnimatedNumber value={totalCards} />
            </p>
          </div>

          {/* Weekly Hit Rate */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Hit Rate
            </p>
            <p
              className={`mt-1 text-2xl font-black tabular-nums ${hitRateColor(weeklyHitRate)}`}
            >
              <AnimatedNumber value={hitPercent} suffix="%" />
            </p>
          </div>
        </div>

        {/* Highlights Row */}
        {(topPlayer || worstTrap || bestLock) && (
          <div className="mt-4 flex flex-col gap-2">
            {/* Top Player */}
            {topPlayer && (
              <div className="flex items-start gap-2 rounded-lg bg-neon-green/10 px-3 py-2">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-neon-green" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neon-green">
                    Top Player
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {topPlayer.playerName}
                    </p>
                    <Badge className="shrink-0 text-[9px] bg-primary/15 text-primary border-primary/30">
                      {sportLabel(topPlayer.sport)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {Math.round(topPlayer.hitRate * 100)}% hit rate across{" "}
                    {topPlayer.pickCount} pick
                    {topPlayer.pickCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Worst Trap */}
            {worstTrap && (
              <div className="flex items-start gap-2 rounded-lg bg-bold-red/10 px-3 py-2">
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-bold-red" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-bold-red">
                    Worst Trap
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground truncate">
                    {worstTrap.playerName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {worstTrap.line}{" "}
                    {CATEGORY_LABELS[worstTrap.statCategory] ??
                      worstTrap.statCategory}{" "}
                    &mdash; {Math.round(worstTrap.hitRate * 100)}% hit rate
                  </p>
                </div>
              </div>
            )}

            {/* Best Lock */}
            {bestLock && (
              <div className="flex items-start gap-2 rounded-lg bg-neon-green/10 px-3 py-2">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-neon-green" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neon-green">
                    Best Lock
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground truncate">
                    {bestLock.playerName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {bestLock.line}{" "}
                    {CATEGORY_LABELS[bestLock.statCategory] ??
                      bestLock.statCategory}{" "}
                    &mdash; {Math.round(bestLock.hitRate * 100)}% hit rate
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personal Weekly Stats */}
        {personalWeekly && (
          <>
            <div className="my-4 border-t border-border/40" />
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Your Week
                </p>
                <PersonalWeeklyRow stats={personalWeekly} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Personal weekly sub-component
// ---------------------------------------------------------------------------

function PersonalWeeklyRow({ stats }: { stats: WeeklyPersonalStats }) {
  const userPercent = Math.round(stats.weeklyHitRate * 100);
  const platformPercent = Math.round(stats.platformWeeklyHitRate * 100);
  const delta = userPercent - platformPercent;
  const deltaSign = delta >= 0 ? "+" : "";
  const deltaColor = delta >= 0 ? "text-neon-green" : "text-bold-red";

  return (
    <div className="mt-1">
      <p className="text-sm text-foreground">
        <span className={`font-bold tabular-nums ${hitRateColor(stats.weeklyHitRate)}`}>
          {userPercent}%
        </span>{" "}
        hit rate across {stats.totalPicks} pick
        {stats.totalPicks !== 1 ? "s" : ""}{" "}
        <span className={`text-xs font-semibold ${deltaColor}`}>
          ({deltaSign}{delta}% vs platform)
        </span>
      </p>

      {/* Mini trend dots */}
      {stats.dailyTrend.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          {stats.dailyTrend.map((day) => {
            const pct = Math.round(day.hitRate * 100);
            const dotColor =
              day.picks === 0
                ? "bg-border/50"
                : pct >= 60
                  ? "bg-neon-green"
                  : pct >= 40
                    ? "bg-electric-blue"
                    : "bg-bold-red";
            return (
              <div
                key={day.date}
                className={`h-2 w-2 rounded-full ${dotColor}`}
                title={
                  day.picks === 0
                    ? `${day.date}: no picks`
                    : `${day.date}: ${pct}% (${day.picks} picks)`
                }
              />
            );
          })}
          <span className="ml-1 text-[10px] text-muted-foreground">
            7-day trend
          </span>
        </div>
      )}
    </div>
  );
}
