"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import type { ChallengeDetail } from "@/lib/challenges/queries";
import { useLiveChallenge } from "@/lib/challenges/use-live-challenge";
import { useChallengeDetailRealtime } from "@/hooks/useChallengeDetailRealtime";
import type { LivePickData } from "@/lib/cards/live-types";
import { toLivePickData } from "@/lib/cards/live-types";
import GameScoreBanner from "@/components/live/GameScoreBanner";
import LivePickCard from "@/components/live/LivePickCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/icons/UserAvatar";
import OpponentAvatar from "@/components/challenges/OpponentAvatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle, Loader2, Crown, UserPlus, Flame } from "lucide-react";
import InvitePanel from "@/components/challenges/InvitePanel";
import ReactionBar from "@/components/challenges/ReactionBar";
import TrashTalkBubble from "@/components/challenges/TrashTalkBubble";
import QuickActions from "@/components/challenges/QuickActions";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import ShareButton from "@/components/ui/ShareButton";
import type { IconConfig } from "@/lib/icons/types";
import { parseIconConfig } from "@/lib/icons/parse";
import type { GameMode } from "@/lib/modes/types";
import { getOpponentDisplayName } from "@/lib/challenges/display";
import UserProfilePopover from "@/components/user/UserProfilePopover";
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
  username,
  avatarUrl,
  iconConfig,
  userId,
  card,
  isWinner,
  showPicks,
  livePickMap,
  hasLiveGames,
  liveLoading,
  side,
  avatarSlot,
}: {
  label: string;
  name: string;
  /** URL-safe username for the profile popover (may differ from display name) */
  username?: string;
  avatarUrl: string | null;
  iconConfig: IconConfig | null;
  userId: string;
  card: ChallengeDetail["challenger_card"];
  isWinner: boolean;
  showPicks: boolean;
  livePickMap: Map<string, LivePickData>;
  hasLiveGames: boolean;
  liveLoading: boolean;
  side: "left" | "right";
  /** Override the default UserAvatar (e.g. with OpponentAvatar for email invites) */
  avatarSlot?: React.ReactNode;
}) {
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
        {avatarSlot ?? (
          <UserProfilePopover
            userId={userId}
            username={username}
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              iconConfig={iconConfig}
              userId={userId}
              username={name}
              size={56}
              className={isWinner ? "animate-winner-ring" : undefined}
            />
          </UserProfilePopover>
        )}
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
          wagerLabel={
            card.heat_score != null ? (
              <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-orange-400">
                <Flame className="h-3 w-3" />
                {card.heat_score}
              </span>
            ) : undefined
          }
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

/* ---------- Helpers ---------- */

function liveHitCount(pickMap: Map<string, LivePickData>): number {
  let hits = 0;
  for (const lp of pickMap.values()) {
    if (lp.trending === "hit") hits++;
  }
  return hits;
}

/* ---------- Main Component ---------- */

export default function ChallengeMatchup({
  challenge,
  currentUserId,
}: ChallengeMatchupProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suppress the realtime handler briefly after the current user triggers an
  // action (accept/decline/cancel). The API handler already calls
  // router.refresh(), so the realtime event that follows ~100-500ms later is
  // redundant. Without this, the page refreshes twice.
  const suppressRealtimeRef = useRef(false);

  // Detect pending picks from the email-invite sign-in flow synchronously
  // so the very first render shows the loader instead of Accept/Decline.
  const [hasPendingPicks] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem("pending_card_picks");
      if (!raw) return false;
      return JSON.parse(raw).challengeId === challenge.id;
    } catch {
      return false;
    }
  });
  const [showInvite, setShowInvite] = useState(false);
  const prefersReduced = useReducedMotion();

  // Live stats — only enabled when cards are locked (games still in progress).
  // Resolved challenges use the server-rendered data which includes heat_score
  // and correct final scores — live polling would overwrite those with incomplete data.
  const shouldFetchLive =
    challenge.status !== "resolved" && (
      challenge.challenger_card?.status === "locked" ||
      challenge.opponent_card?.status === "locked"
    );

  const { data: liveData, isLoading: liveLoading, error: liveError, challengeResolved } = useLiveChallenge(
    challenge.id,
    shouldFetchLive
  );

  // Refresh page data when the backend resolves cards/challenge during live polling
  useEffect(() => {
    if (challengeResolved) {
      router.refresh();
    }
  }, [challengeResolved, router]);

  // Realtime subscription for challenge state changes (opponent accepts,
  // locks in picks, challenge activates/resolves). Complementary to
  // useLiveChallenge which polls for live game scores during active games.
  const handleRealtimeChange = useCallback(() => {
    if (suppressRealtimeRef.current) return;
    router.refresh();
  }, [router]);

  useChallengeDetailRealtime({
    challengeId: challenge.id,
    currentUserId,
    onChallengeChange: handleRealtimeChange,
  });

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

  // Compute live scores from trending data (DB score is 0 for unresolved cards)
  const challengerLiveScore = liveData ? liveHitCount(challengerLivePickMap) : null;
  const opponentLiveScore = liveData ? liveHitCount(opponentLivePickMap) : null;

  const isChallenger = challenge.challenger_id === currentUserId;
  const isEmailInviteOpponent = !challenge.opponent && !!challenge.opponent_email;
  const challengerName = challenge.challenger.username;
  const opponentName = getOpponentDisplayName(challenge.opponent, challenge.opponent_email);

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

  async function handleInviteUsers(friends: Array<{ id: string; username: string }>) {
    setActionLoading(true);
    setError(null);
    try {
      for (const friend of friends) {
        const res = await fetch(`/api/challenges/${challenge.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "invite", user_id: friend.id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to invite");
        }
      }
      setShowInvite(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleInviteEmail(email: string) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to invite");
      }
      setShowInvite(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAction(action: "accept" | "decline" | "cancel") {
    setActionLoading(true);
    setError(null);
    // Suppress realtime handler so the echo of our own action doesn't cause
    // a redundant second refresh. Clear after 2s — generous enough to catch
    // the realtime event (~100-500ms), short enough to not mask a real
    // opponent event that arrives right after.
    suppressRealtimeRef.current = true;
    setTimeout(() => { suppressRealtimeRef.current = false; }, 2000);
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
      suppressRealtimeRef.current = false;
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
                        : challenge.status === "draft"
                          ? "text-blue-400"
                          : "text-muted-foreground"
                )}>
                  {challenge.status === "resolved" ? "Completed"
                    : challenge.status === "accepted" ? "Active"
                    : challenge.status === "draft" ? "Draft"
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
          senderIconConfig={parseIconConfig(challenge.challenger.icon_config)}
          senderId={challenge.challenger.id}
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
            {/* QuickActions requires an opponent — email-invite challenges may not have one yet */}
            {(() => {
              const otherUserId = isChallenger ? challenge.opponent_id : challenge.challenger_id;
              if (!otherUserId) return null;
              return (
                <QuickActions
                  challengeId={challenge.id}
                  opponentId={otherUserId}
                  gameMode={(challenge.game_mode as GameMode) ?? "classic"}
                  isParticipant={true}
                  isResolved={challenge.status === "resolved"}
                />
              );
            })()}
          </div>
        </FadeIn>
      )}

      {/* Matchup Layout — no wrapper card, just the two sides */}
      <div className="flex flex-col items-stretch gap-6 md:flex-row md:gap-4">
        {/* Challenger Side */}
        <PlayerSide
          label={isChallenger ? "You" : "Opponent"}
          name={challengerName}
          username={challenge.challenger.username}
          avatarUrl={challenge.challenger.avatar_url}
          iconConfig={parseIconConfig(challenge.challenger.icon_config)}
          userId={challenge.challenger.id}
          card={challenge.challenger_card}
          isWinner={challengerIsWinner}
          showPicks={isChallenger ? showMyPicks : showTheirPicks}
          livePickMap={challengerLivePickMap}
          hasLiveGames={liveData?.challenger_card?.has_live_games ?? false}
          liveLoading={shouldFetchLive && !liveData && !liveError}
          side="left"
        />

        {/* Score + VS column */}
        <ScaleIn delay={0.2} duration={0.3} initialScale={0.8} className="shrink-0 md:self-stretch">
          <div className="flex flex-col items-center gap-2 md:h-full">
            {/* Score — below avatar row */}
            {challenge.challenger_card && challenge.opponent_card &&
              (challenge.status === "active" || challenge.status === "resolved") && (
              <>
                <span className="mt-6 text-lg font-bold tabular-nums tracking-wide md:mt-10">
                  {challengerLiveScore ?? challenge.challenger_card.score} &ndash; {opponentLiveScore ?? challenge.opponent_card.score}
                </span>
                {challenge.status === "resolved" &&
                  challenge.challenger_card.heat_score != null &&
                  challenge.opponent_card.heat_score != null && (
                  <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-orange-400">
                    <Flame className="h-3 w-3" />
                    {challenge.challenger_card.heat_score} &ndash; {challenge.opponent_card.heat_score}
                  </span>
                )}
              </>
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
          username={challenge.opponent?.username}
          avatarUrl={challenge.opponent?.avatar_url ?? null}
          iconConfig={parseIconConfig(challenge.opponent?.icon_config ?? null)}
          userId={challenge.opponent?.id ?? ""}
          card={challenge.opponent_card}
          isWinner={opponentIsWinner}
          showPicks={isChallenger ? showTheirPicks : showMyPicks}
          livePickMap={opponentLivePickMap}
          hasLiveGames={liveData?.opponent_card?.has_live_games ?? false}
          liveLoading={shouldFetchLive && !liveData && !liveError}
          side="right"
          avatarSlot={isEmailInviteOpponent ? (
            <OpponentAvatar
              opponent={challenge.opponent}
              opponentEmail={challenge.opponent_email}
              displayName={opponentName}
              size={56}
            />
          ) : undefined}
        />
      </div>

      {/* Invite friends — converts 1v1 to group challenge */}
      {challenge.status !== "resolved" && challenge.status !== "cancelled" && (
        <FadeIn delay={0.2} duration={0.3}>
          {!showInvite ? (
            <Button
              variant="outline"
              size="sm"
              className="mx-auto flex gap-1.5"
              onClick={() => setShowInvite(true)}
            >
              <UserPlus className="h-4 w-4" />
              Invite Friends
            </Button>
          ) : (
            <InvitePanel
              excludeUserIds={[challenge.challenger_id, challenge.opponent?.id].filter(Boolean) as string[]}
              actionLoading={actionLoading}
              onInviteUsers={handleInviteUsers}
              onInviteEmail={handleInviteEmail}
              onClose={() => setShowInvite(false)}
            />
          )}
        </FadeIn>
      )}

      {/* Status-specific CTAs */}
      {challenge.status === "draft" && isChallenger && (
        <FadeIn delay={0.25} duration={0.3}>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Pick your props to send this challenge
                </p>
                <Link
                  href={
                    challenge.game_mode === "mirror" || challenge.game_mode === "random"
                      ? `/challenges/${challenge.id}/ballot`
                      : `/props?challenge_id=${challenge.id}`
                  }
                >
                  <Button size="sm">Pick Props</Button>
                </Link>
                <Button
                  onClick={() => handleAction("cancel")}
                  disabled={actionLoading}
                  variant="outline"
                  size="sm"
                >
                  {actionLoading ? "Cancelling..." : "Cancel"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

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
            ) : hasPendingPicks ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Locking in your picks...
                </p>
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
