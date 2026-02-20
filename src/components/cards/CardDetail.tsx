"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardWithPicks } from "@/lib/cards/api";
import { toLivePickData } from "@/lib/cards/live-types";
import type { LivePickData, LiveGameStatus } from "@/lib/cards/live-types";
import ShareButton from "@/components/cards/ShareButton";
import { useLiveStats } from "@/lib/cards/use-live-stats";
import GameScoreBanner from "@/components/live/GameScoreBanner";
import LivePickRow from "@/components/live/LivePickRow";
import { teamTricode, teamLogoUrl, gameUrl } from "@/lib/constants";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SlideUp, ScaleIn, FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

/** Build LiveGameStatus[] from card picks' DB game data (for resolved cards with no live feed). */
function buildGamesFromPicks(picks: CardWithPicks["picks"]): LiveGameStatus[] {
  const seen = new Set<string>();
  const games: LiveGameStatus[] = [];

  for (const pick of picks) {
    const g = pick.props?.games;
    if (!g) continue;
    const gameId = pick.props!.game_id;
    if (seen.has(gameId)) continue;
    seen.add(gameId);

    const homeTeam = g.home_team ?? "";
    const awayTeam = g.away_team ?? "";

    games.push({
      game_id: gameId,
      external_event_id: g.external_event_id ?? gameId,
      status: (g.status as "scheduled" | "live" | "final") ?? "final",
      period: g.status === "final" ? 4 : 0,
      clock: g.status === "final" ? "0:00" : "",
      sport: g.sport ?? undefined,
      home_team: homeTeam,
      away_team: awayTeam,
      home_tricode: teamTricode(homeTeam),
      away_tricode: teamTricode(awayTeam),
      home_score: g.home_score ?? 0,
      away_score: g.away_score ?? 0,
      home_logo: teamLogoUrl(homeTeam) || teamLogoUrl(teamTricode(homeTeam)),
      away_logo: teamLogoUrl(awayTeam) || teamLogoUrl(teamTricode(awayTeam)),
      commence_time: g.commence_time ?? null,
      game_url: gameUrl(g.sport ?? undefined, g.external_event_id ?? ""),
    });
  }

  return games;
}

function StatusBadge({ status, score, total }: { status: string; score: number; total: number }) {
  if (status === "locked") {
    return (
      <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/15 text-amber-400">
        Locked
      </Badge>
    );
  }

  const isGoodScore = score >= total / 2;
  return (
    <Badge
      variant="secondary"
      className={
        isGoodScore
          ? "border-neon-green/30 bg-neon-green/15 text-neon-green"
          : "border-bold-red/30 bg-bold-red/15 text-bold-red"
      }
    >
      {score}/{total} Correct
    </Badge>
  );
}

export default function CardDetail({ card, linked = true }: { card: CardWithPicks; linked?: boolean }) {
  const isLocked = card.status === "locked";
  // Also fetch live data for resolved cards with missing actual_value —
  // resolution may have run before boxscore data was available on ESPN.
  // The hook auto-stops polling once has_live_games is false (one-shot fetch).
  const hasMissingValues =
    card.status === "resolved" &&
    card.picks.some(
      (p) => p.actual_value === null && (p.result === "hit" || p.result === "miss")
    );
  const router = useRouter();
  const { data: liveData, cardResolved } = useLiveStats(card.id, isLocked || hasMissingValues);

  // Refresh page data when the backend resolves the card during live polling
  useEffect(() => {
    if (cardResolved) {
      router.refresh();
    }
  }, [cardResolved, router]);

  const livePickMap = new Map<string, LivePickData>();
  if (liveData) {
    for (const lp of liveData.picks) {
      livePickMap.set(lp.pick_id, lp);
    }
  }

  const fallbackGames = useMemo(
    () => (card.status === "resolved" ? buildGamesFromPicks(card.picks) : []),
    [card.status, card.picks],
  );

  const date = new Date(card.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const href = card.challenge_id
    ? `/challenges/${card.challenge_id}`
    : `/cards/${card.id}`;

  const Wrapper = linked
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={href} className="block">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  const prefersReduced = useReducedMotion();

  return (
    <Wrapper>
      <SlideUp offset={16} duration={0.4}>
        <Card className="border-border bg-card">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 py-3">
        <div className="flex items-center gap-3">
          <ScaleIn delay={0.1} duration={0.35}>
            <StatusBadge status={card.status} score={card.score} total={card.total_picks} />
          </ScaleIn>
          {card.challenge_id ? (
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
              H2H
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">
              Solo
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        {liveData?.has_live_games && (
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground" />
            <span className="text-xs font-bold text-foreground">LIVE</span>
          </div>
        )}
      </CardHeader>

      <AnimatePresence>
        {(() => {
          const gamesToShow = liveData?.games ?? (fallbackGames.length > 0 ? fallbackGames : undefined);
          return gamesToShow && gamesToShow.length > 0 ? (
            <motion.div
              key="game-score-banner"
              className="px-3 pb-2"
              initial={prefersReduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <GameScoreBanner games={gamesToShow} />
            </motion.div>
          ) : null;
        })()}
      </AnimatePresence>

      <Separator />

      <CardContent className="flex flex-col gap-0 p-0">
        <StaggerChildren staggerDelay={0.07} className="flex flex-col gap-0">
          {card.picks.map((pick) => {
            // Use live data if available, otherwise convert the static pick
            const livePick = livePickMap.get(pick.id) ?? toLivePickData({
              id: pick.id,
              selection: pick.selection,
              result: pick.result,
              actual_value: pick.actual_value,
              prop: pick.props ? {
                id: pick.prop_id,
                player_name: pick.props.player_name,
                player_id: pick.props.player_id,
                player_team: pick.props.player_team,
                player_position: pick.props.player_position,
                stat_category: pick.props.stat_category,
                line: pick.props.line,
                game_id: pick.props.game_id,
                games: pick.props.games,
              } : null,
            });

            return (
              <StaggerItem key={pick.id}>
                <LivePickRow pick={livePick} />
              </StaggerItem>
            );
          })}
        </StaggerChildren>
      </CardContent>

      {card.status === "resolved" && (
        <FadeIn delay={0.3}>
          <CardFooter className="justify-end px-4 py-3">
            <ShareButton cardId={card.id} />
          </CardFooter>
        </FadeIn>
      )}
        </Card>
      </SlideUp>
    </Wrapper>
  );
}
