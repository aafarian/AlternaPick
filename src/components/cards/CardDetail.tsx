"use client";

import { useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CardWithPicks } from "@/lib/cards/api";
import { toLivePickData } from "@/lib/cards/live-types";
import type { LivePickData, LiveGameStatus } from "@/lib/cards/live-types";
import ShareButton from "@/components/cards/ShareButton";
import { useLiveStats } from "@/lib/cards/use-live-stats";
import GameScoreBanner from "@/components/live/GameScoreBanner";
import { Skeleton } from "@/components/ui/skeleton";
import LivePickRow from "@/components/live/LivePickRow";
import { teamTricode, teamLogoUrl, gameUrl, CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CardHeatScoreBadge from "@/components/cards/CardHeatScoreBadge";
import { Separator } from "@/components/ui/separator";
import { SlideUp, ScaleIn, FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

/** Build LiveGameStatus[] from card picks' DB game data (for resolved cards with no live feed). */
function buildGamesFromPicks(picks: CardWithPicks["picks"]): LiveGameStatus[] {
  const seen = new Set<string>();
  const games: LiveGameStatus[] = [];

  for (const pick of picks) {
    const g = pick.props?.games;
    const gameId = pick.props?.game_id;
    if (!g || !gameId || seen.has(gameId)) continue;
    seen.add(gameId);

    const sport = g.sport ?? "";
    const home = pick.props?.games?.home_team ?? "";
    const away = pick.props?.games?.away_team ?? "";

    games.push({
      game_id: gameId,
      external_event_id: gameId,
      status: "final",
      period: sport === "soccer" ? 2 : 4,
      clock: "0:00",
      sport,
      home_team: home,
      away_team: away,
      home_tricode: teamTricode(home),
      away_tricode: teamTricode(away),
      home_score: g.home_score ?? 0,
      away_score: g.away_score ?? 0,
      home_logo: teamLogoUrl(home) ?? undefined,
      away_logo: teamLogoUrl(away) ?? undefined,
      commence_time: g.commence_time ?? null,
      game_url: gameUrl(sport, gameId) ?? undefined,
    });
  }

  return games;
}

function StatusBadge({ status, score, total }: { status: string; score: number; total: number }) {
  const label = status === "resolved" ? `${score}/${total} Correct` : status === "locked" ? "Locked" : "Draft";
  const variant = status === "resolved"
    ? score > 0 && score === total ? "bg-neon-green/15 text-neon-green border-neon-green/30"
      : score > 0 ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
      : "bg-bold-red/15 text-bold-red border-bold-red/30"
    : status === "locked" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-muted/15 text-muted-foreground border-border";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variant}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LiveCardContent — owns the live data hook, isolates re-renders from header
// ---------------------------------------------------------------------------

const LiveCardContent = memo(function LiveCardContent({
  card,
  animate,
  condensed = false,
  categoryStats,
}: {
  card: CardWithPicks;
  animate: boolean;
  condensed?: boolean;
  categoryStats?: Map<string, { rate: number; total: number }>;
}) {
  const isLocked = card.status === "locked";
  const router = useRouter();
  const { data: liveData, cardResolved } = useLiveStats(card.id, isLocked);

  useEffect(() => {
    if (cardResolved) router.refresh();
  }, [cardResolved, router]);

  const livePickMap = useMemo(() => {
    const map = new Map<string, LivePickData>();
    if (liveData) {
      for (const lp of liveData.picks) {
        map.set(lp.pick_id, lp);
      }
    }
    return map;
  }, [liveData]);

  const fallbackGames = useMemo(
    () => (card.status === "resolved" ? buildGamesFromPicks(card.picks) : []),
    [card.status, card.picks],
  );

  const prefersReduced = useReducedMotion();
  const gamesToShow = liveData?.games ?? (fallbackGames.length > 0 ? fallbackGames : undefined);

  return (
    <>
      {/* LIVE indicator — only when live games are active */}
      {liveData?.has_live_games && (
        <div className="absolute right-4 top-3 flex items-center gap-1">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground" />
          <span className="text-xs font-bold text-foreground">LIVE</span>
        </div>
      )}

      {/* Game score banner — hidden in condensed view */}
      {!condensed && (() => {
        if (isLocked && !gamesToShow) {
          return (
            <div className="flex gap-2 px-3 pb-2">
              <Skeleton className="h-[50px] w-[200px] rounded-lg" />
            </div>
          );
        }
        if (!gamesToShow || gamesToShow.length === 0) return null;
        if (!animate) {
          return (
            <div className="px-3 pb-2">
              <GameScoreBanner games={gamesToShow} />
            </div>
          );
        }
        return (
          <AnimatePresence>
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
          </AnimatePresence>
        );
      })()}

      <Separator />

      {/* Pick rows + optional stats side panel */}
      <CardContent className="flex gap-0 p-0">
        {/* Pick rows */}
        <div className="flex-1 min-w-0">
        {animate ? (
          <StaggerChildren staggerDelay={0.07} className="flex flex-col gap-0">
            {card.picks.map((pick) => {
              const livePick = livePickMap.get(pick.id) ?? toLivePickData({
                id: pick.id, selection: pick.selection, result: pick.result,
                actual_value: pick.actual_value, notch: pick.notch ?? 0,
                adjusted_line: pick.adjusted_line, heat_score: pick.heat_score,
                prop: pick.props ? {
                  id: pick.prop_id, player_name: pick.props.player_name,
                  player_id: pick.props.player_id, player_team: pick.props.player_team,
                  player_position: pick.props.player_position,
                  stat_category: pick.props.stat_category, line: pick.props.line,
                  game_id: pick.props.game_id, games: pick.props.games,
                } : null,
              });
              return (
                <StaggerItem key={pick.id}>
                  <LivePickRow
                    pick={livePick}
                    showQualityTokens={false}
                    variant={condensed ? "condensed" : "full"}
                  />
                </StaggerItem>
              );
            })}
          </StaggerChildren>
        ) : (
          <div className="flex flex-col gap-0">
            {card.picks.map((pick) => {
              const livePick = livePickMap.get(pick.id) ?? toLivePickData({
                id: pick.id, selection: pick.selection, result: pick.result,
                actual_value: pick.actual_value, notch: pick.notch ?? 0,
                adjusted_line: pick.adjusted_line, heat_score: pick.heat_score,
                prop: pick.props ? {
                  id: pick.prop_id, player_name: pick.props.player_name,
                  player_id: pick.props.player_id, player_team: pick.props.player_team,
                  player_position: pick.props.player_position,
                  stat_category: pick.props.stat_category, line: pick.props.line,
                  game_id: pick.props.game_id, games: pick.props.games,
                } : null,
              });
              return (
                <LivePickRow
                  key={pick.id}
                  pick={livePick}
                  showQualityTokens={false}
                  variant={condensed ? "condensed" : "full"}
                />
              );
            })}
          </div>
        )}
        </div>

        {/* Stats side panel — visible on lg+ in condensed view */}
        {condensed && categoryStats && categoryStats.size > 0 && (
          <div className="hidden border-l border-border lg:flex lg:w-44 lg:shrink-0 lg:flex-col lg:justify-center lg:gap-3 lg:px-4 lg:py-2">
            {card.picks.map((pick) => {
              const cat = pick.props?.stat_category ?? "";
              const stats = categoryStats.get(cat);
              if (!stats) return <div key={pick.id} className="h-[50px]" />;
              const pct = Math.round(stats.rate * 100);
              return (
                <div key={pick.id} className="flex flex-col gap-0.5">
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    pct >= 60 ? "text-emerald-500" : pct >= 40 ? "text-blue-400" : "text-red-400"
                  )}>
                    {pct}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {CATEGORY_LABELS[pick.props?.stat_category as keyof typeof CATEGORY_LABELS] ?? cat} ({stats.total})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Share button (resolved only, hidden in condensed) */}
      {card.status === "resolved" && !condensed && (
        <FadeIn delay={animate ? 0.3 : 0}>
          <CardFooter className="justify-end px-4 py-3">
            <ShareButton cardId={card.id} />
          </CardFooter>
        </FadeIn>
      )}
    </>
  );
});

// ---------------------------------------------------------------------------
// CardDetail — static header + LiveCardContent child
// ---------------------------------------------------------------------------

export default function CardDetail({ card, linked = true, condensed = false, categoryStats }: { card: CardWithPicks; linked?: boolean; condensed?: boolean; categoryStats?: Map<string, { rate: number; total: number }> }) {
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

  const animate = linked;

  return (
    <Wrapper>
      <SlideUp offset={animate ? 16 : 0} duration={animate ? 0.4 : 0}>
        <Card className="relative border-border">
          {/* Static header — never re-renders from live data */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <ScaleIn delay={animate ? 0.1 : 0} duration={animate ? 0.35 : 0}>
                <StatusBadge status={card.status} score={card.score} total={card.total_picks} />
              </ScaleIn>
              {card.challenge_id && card.challenges ? (
                card.challenges.lobby_type === "group" ? (
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
                    Group
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
                    H2H{(() => {
                      const c = card.challenges;
                      const opponent = card.user_id === c.challenger_id ? c.opponent : c.challenger;
                      const name = opponent?.username ?? (c.opponent_email ? "Invited" : null);
                      return name ? ` · ${name}` : "";
                    })()}
                  </Badge>
                )
              ) : card.challenge_id ? (
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
            <div className="flex items-center gap-2">
              <CardHeatScoreBadge
                heatScore={card.heat_score}
                wager={card.fire_token_wager}
                payout={card.fire_token_payout}
                cardSize={card.card_size}
                pickNotches={card.picks.map((p) => p.notch ?? 0)}
                score={card.score}
                totalPicks={card.total_picks}
              />
            </div>
          </div>

          {/* Live content — isolated re-renders */}
          <LiveCardContent card={card} animate={animate} condensed={condensed} categoryStats={categoryStats} />
        </Card>
      </SlideUp>
    </Wrapper>
  );
}
