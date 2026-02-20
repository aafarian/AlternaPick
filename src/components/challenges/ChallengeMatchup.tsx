"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import type { ChallengeDetail } from "@/lib/challenges/queries";
import { useLiveChallenge } from "@/lib/challenges/use-live-challenge";
import type { LivePickData } from "@/lib/cards/live-types";
import { toLivePickData } from "@/lib/cards/live-types";
import GameScoreBanner from "@/components/live/GameScoreBanner";
import LivePickCard from "@/components/live/LivePickCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle, Loader2, Crown } from "lucide-react";
import ReactionBar from "@/components/challenges/ReactionBar";
import TrashTalkBubble from "@/components/challenges/TrashTalkBubble";
import QuickActions from "@/components/challenges/QuickActions";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import ShareButton from "@/components/ui/ShareButton";
import type { GameMode } from "@/lib/modes/types";
import { SlideUp, ScaleIn, FadeIn } from "@/components/motion";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

interface ChallengeMatchupProps {
  challenge: ChallengeDetail;
  currentUserId: string;
}

/* ---------- Player Side Panel ---------- */

function PlayerSide({
  label,
  name,
  avatarUrl,
  card,
  isWinner,
  showPicks,
  livePickMap,
  hasLiveGames,
  liveLoading,
  side,
}: {
  label: string;
  name: string;
  avatarUrl: string | null;
  card: ChallengeDetail["challenger_card"];
  isWinner: boolean;
  showPicks: boolean;
  livePickMap: Map<string, LivePickData>;
  hasLiveGames: boolean;
  liveLoading: boolean;
  side: "left" | "right";
}) {
  const initial = name.charAt(0).toUpperCase();
  const prefersReduced = useReducedMotion();

  // Build LivePickData[] — always render picks immediately using fallback, overlay live data when available
  const picks: LivePickData[] =
    showPicks && card
      ? card.picks.map((pick) => {
          const live = livePickMap.get(pick.id);
          if (!live) return toLivePickData(pick);
          const fallback = toLivePickData(pick);
          // Prefer live data, but don't overwrite resolved values with nulls
          return {
            ...live,
            current_value: live.current_value ?? fallback.current_value,
            trending: live.trending ?? fallback.trending,
          };
        })
      : [];

  const statusBadge = card ? (
    <ScaleIn delay={0.25} duration={0.3} initialScale={0.7}>
      <Badge
        variant="secondary"
        className={cn(
          "text-xs",
          card.status === "resolved"
            ? "bg-purple-500/15 text-purple-400"
            : card.status === "locked"
              ? "bg-amber-500/15 text-amber-400"
              : "bg-muted/15 text-muted-foreground"
        )}
      >
        {card.status === "resolved"
          ? `${card.score}/${card.total_picks}`
          : card.status === "locked"
            ? "Locked In"
            : "Draft"}
      </Badge>
    </ScaleIn>
  ) : null;

  // Slide direction: left panel comes from left, right panel from right
  const slideX = side === "left" ? -20 : 20;

  const content = (
    <div className="flex flex-1 flex-col gap-3 rounded-xl">
      {/* Player identity */}
      <div className="flex flex-col items-center gap-2">
        <Avatar
          className={cn(
            "h-14 w-14",
            isWinner && "animate-winner-ring"
          )}
        >
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback
            className={cn(
              "text-lg font-bold",
              isWinner
                ? "bg-neon-green/20 text-neon-green"
                : "bg-primary/10 text-primary"
            )}
          >
            {initial}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">
          {isWinner && <Crown className="mr-1 inline h-4 w-4 text-neon-green" />}
          {name}
        </span>
        {isWinner ? (
          <span className="text-xs font-semibold text-neon-green">Winner</span>
        ) : (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>

      {/* Card — shared LivePickCard */}
      {card ? (
        <LivePickCard
          picks={picks}
          hasLiveGames={hasLiveGames}
          statusLabel={statusBadge}
          loading={liveLoading}
          pickCount={card.picks.length}
          showGameScores={false}
        />
      ) : (
        <p className="text-center text-xs text-muted-foreground">No card yet</p>
      )}
    </div>
  );

  if (prefersReduced) {
    return content;
  }

  return (
    <motion.div
      className="flex flex-1"
      initial={{ opacity: 0, x: slideX }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
    >
      {content}
    </motion.div>
  );
}

/* ---------- Main Component ---------- */

export default function ChallengeMatchup({
  challenge,
  currentUserId,
}: ChallengeMatchupProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  // Live stats — enabled when cards are locked (polling) or challenge is
  // resolved (single fetch for final scores so users can see results)
  const shouldFetchLive =
    challenge.challenger_card?.status === "locked" ||
    challenge.opponent_card?.status === "locked" ||
    challenge.status === "resolved";

  const { data: liveData, isLoading: liveLoading, challengeResolved } = useLiveChallenge(
    challenge.id,
    shouldFetchLive
  );

  // Refresh page data when the backend resolves cards/challenge during live polling
  useEffect(() => {
    if (challengeResolved) {
      router.refresh();
    }
  }, [challengeResolved, router]);

  // Build live pick maps
  const challengerLivePickMap = new Map<string, LivePickData>();
  const opponentLivePickMap = new Map<string, LivePickData>();
  if (liveData) {
    for (const lp of liveData.challenger_card?.picks ?? []) {
      challengerLivePickMap.set(lp.pick_id, lp);
    }
    for (const lp of liveData.opponent_card?.picks ?? []) {
      opponentLivePickMap.set(lp.pick_id, lp);
    }
  }

  const isChallenger = challenge.challenger_id === currentUserId;
  const challengerName = challenge.challenger.username;
  const opponentName = challenge.opponent.username;

  // Determine if the current user has submitted their card
  const myCard = isChallenger
    ? challenge.challenger_card
    : challenge.opponent_card;
  const theirCard = isChallenger
    ? challenge.opponent_card
    : challenge.challenger_card;
  const otherPlayerName = isChallenger ? opponentName : challengerName;

  // Pick visibility:
  // - Always show your own picks (any status)
  // - Only show opponent's picks when both cards are locked (active/resolved)
  const showMyPicks = !!myCard;
  const showTheirPicks =
    challenge.status === "active" || challenge.status === "resolved";

  // Winner detection
  const challengerIsWinner =
    challenge.status === "resolved" &&
    challenge.winner_id === challenge.challenger_id;
  const opponentIsWinner =
    challenge.status === "resolved" &&
    challenge.winner_id === challenge.opponent_id;
  const isDraw =
    challenge.status === "resolved" && challenge.winner_id === null;

  // Confetti on victory
  const isWinner = challenge.status === "resolved" && challenge.winner_id === currentUserId;
  useEffect(() => {
    if (!isWinner) return;
    const duration = 1500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#00d26a", "#3b82f6", "#fbbf24"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#00d26a", "#3b82f6", "#fbbf24"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [isWinner]);

  const date = new Date(challenge.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleAction(action: "accept" | "decline" | "cancel") {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Failed to ${action} challenge`
        );
      }
      // After accepting mirror/random, redirect to ballot page
      if (action === "accept" && (challenge.game_mode === "mirror" || challenge.game_mode === "random")) {
        router.push(`/challenges/${challenge.id}/ballot`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} challenge`
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <SlideUp duration={0.3} offset={16}>
        <Link
          href="/challenges"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Challenges
        </Link>
      </SlideUp>

      {/* Header */}
      <SlideUp delay={0.05} duration={0.3} offset={16}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Challenge Matchup
            </h1>
            {challenge.game_mode && (
              <GameModeBadge mode={challenge.game_mode as GameMode} size="lg" showClassic />
            )}
            {liveData?.has_live_games ? (
              <ScaleIn delay={0.15} duration={0.3} initialScale={0.7}>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="text-xs font-bold text-primary">LIVE</span>
                </div>
              </ScaleIn>
            ) : (
              <ScaleIn delay={0.15} duration={0.3} initialScale={0.7}>
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  challenge.status === "active" || challenge.status === "accepted"
                    ? "text-neon-green"
                    : challenge.status === "resolved"
                      ? "text-purple-400"
                      : challenge.status === "pending"
                        ? "text-amber-400"
                        : "text-muted-foreground"
                )}>
                  {challenge.status === "resolved" ? "Completed"
                    : challenge.status === "accepted" ? "Active"
                    : challenge.status.charAt(0).toUpperCase() + challenge.status.slice(1)}
                </span>
              </ScaleIn>
            )}
            {liveLoading && !liveData && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <span className="text-sm text-muted-foreground">{date}</span>
        </div>
      </SlideUp>

      {/* Trash Talk Bubble */}
      {challenge.message && (
        <TrashTalkBubble
          message={challenge.message}
          senderName={challengerName}
          senderAvatar={challenge.challenger.avatar_url}
        />
      )}

      {/* Live Game Scores */}
      {liveData && liveData.games.length > 0 ? (
        <GameScoreBanner games={liveData.games} />
      ) : shouldFetchLive && !liveData && (
        <div className="flex gap-2">
          <Skeleton className="h-[50px] w-[100px] shrink-0 rounded-lg" />
          <Skeleton className="h-[50px] w-[100px] shrink-0 rounded-lg" />
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error-alert"
            initial={prefersReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setError(null)}
                  className="ml-2 text-destructive underline"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resolved: reactions, share, result, quick actions — compact group */}
      {challenge.status === "resolved" && (
        <FadeIn delay={0.2} duration={0.3}>
          <div className="flex flex-col items-center gap-2">
            <ReactionBar
              targetType="challenge"
              targetId={challenge.id}
              currentUserId={currentUserId}
            />
            <div className="mb-1 flex items-center gap-3">
              <p className="text-sm font-semibold">
                {isDraw ? (
                  <span className="text-amber-400">It&apos;s a draw!</span>
                ) : isWinner ? (
                  <span className="text-neon-green">You won!</span>
                ) : (
                  <span className="text-bold-red">
                    {isChallenger ? opponentName : challengerName} won!
                  </span>
                )}
              </p>
              <span className="text-muted-foreground/30">|</span>
              <ShareButton
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/challenges/${challenge.id}/share`}
                title={`${challengerName} vs ${opponentName} - AlternaPick Challenge`}
                text={`Check out this challenge on AlternaPick! ${challengerName} vs ${opponentName}`}
              />
            </div>
            <QuickActions
              challengeId={challenge.id}
              opponentId={isChallenger ? challenge.opponent_id : challenge.challenger_id}
              gameMode={(challenge.game_mode as GameMode) ?? "classic"}
              isParticipant={true}
              isResolved={challenge.status === "resolved"}
            />
          </div>
        </FadeIn>
      )}

      {/* Matchup Layout — no wrapper card, just the two sides */}
      <div className="flex flex-col items-stretch gap-6 md:flex-row md:gap-4">
        {/* Challenger Side */}
        <PlayerSide
          label={isChallenger ? "You" : "Opponent"}
          name={challengerName}
          avatarUrl={challenge.challenger.avatar_url}
          card={challenge.challenger_card}
          isWinner={challengerIsWinner}
          showPicks={isChallenger ? showMyPicks : showTheirPicks}
          livePickMap={challengerLivePickMap}
          hasLiveGames={liveData?.challenger_card?.has_live_games ?? false}
          liveLoading={shouldFetchLive && !liveData}
          side="left"
        />

        {/* Score + VS column */}
        <ScaleIn delay={0.2} duration={0.3} initialScale={0.8} className="shrink-0 md:self-stretch">
          <div className="flex flex-col items-center gap-2 md:h-full">
            {/* Score — below avatar row */}
            {challenge.challenger_card && challenge.opponent_card &&
              (challenge.status === "active" || challenge.status === "resolved") && (
              <span className="mt-6 text-lg font-bold tabular-nums tracking-wide md:mt-10">
                {challenge.challenger_card.score} &ndash; {challenge.opponent_card.score}
              </span>
            )}
            {/* VS centered in remaining space */}
            <div className="flex flex-1 items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                VS
              </div>
            </div>
          </div>
        </ScaleIn>

        {/* Opponent Side */}
        <PlayerSide
          label={isChallenger ? "Opponent" : "You"}
          name={opponentName}
          avatarUrl={challenge.opponent.avatar_url}
          card={challenge.opponent_card}
          isWinner={opponentIsWinner}
          showPicks={isChallenger ? showTheirPicks : showMyPicks}
          livePickMap={opponentLivePickMap}
          hasLiveGames={liveData?.opponent_card?.has_live_games ?? false}
          liveLoading={shouldFetchLive && !liveData}
          side="right"
        />
      </div>

      {/* Status-specific CTAs */}
      {challenge.status === "pending" && (
        <FadeIn delay={0.25} duration={0.3}>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            {isChallenger ? (
              <div className="flex flex-col items-center gap-3 text-center">
                {!myCard ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Make your picks while waiting for <span className="font-semibold text-foreground">{opponentName}</span> to accept
                    </p>
                    <Link
                      href={
                        challenge.game_mode === "mirror" || challenge.game_mode === "random"
                          ? `/challenges/${challenge.id}/ballot`
                          : `/props?challenge_id=${challenge.id}`
                      }
                    >
                      <Button size="sm">Make Your Picks</Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Picks submitted! Waiting for <span className="font-semibold text-foreground">{opponentName}</span> to accept
                  </p>
                )}
                <Button
                  onClick={() => handleAction("cancel")}
                  disabled={actionLoading}
                  variant="outline"
                  size="sm"
                >
                  {actionLoading ? "Cancelling..." : "Cancel Challenge"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{challengerName}</span> challenged you!
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAction("accept")}
                    disabled={actionLoading}
                    size="sm"
                  >
                    {actionLoading ? "..." : "Accept"}
                  </Button>
                  <Button
                    onClick={() => handleAction("decline")}
                    disabled={actionLoading}
                    variant="outline"
                    size="sm"
                  >
                    {actionLoading ? "..." : "Decline"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </FadeIn>
      )}

      {challenge.status === "accepted" && (
        <FadeIn delay={0.25} duration={0.3}>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              {!myCard ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Time to make your picks for this challenge!
                  </p>
                  <Link
                    href={
                      challenge.game_mode === "mirror" || challenge.game_mode === "random"
                        ? `/challenges/${challenge.id}/ballot`
                        : `/props?challenge_id=${challenge.id}`
                    }
                  >
                    <Button size="sm">Make Your Picks</Button>
                  </Link>
                </>
              ) : !theirCard ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for <span className="font-semibold text-foreground">{otherPlayerName}</span> to make
                  their picks
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Both players have submitted cards. The challenge will begin soon.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </FadeIn>
      )}

      {challenge.status === "active" && (
        <FadeIn delay={0.25} duration={0.3}>
          <Card className="border-neon-green/20 bg-neon-green/5">
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-semibold text-neon-green">
                  Challenge is live!
                </p>
                <p className="text-xs text-muted-foreground">
                  Both players have locked in their picks. Results will be revealed
                  once games finish.
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
