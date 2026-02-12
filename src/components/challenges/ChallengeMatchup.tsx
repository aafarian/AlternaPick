"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChallengeDetail } from "@/lib/challenges/queries";
import { useLiveChallenge } from "@/lib/challenges/use-live-challenge";
import type { LivePickData } from "@/lib/cards/live-types";
import { toLivePickData } from "@/lib/cards/live-types";
import { CHALLENGE_STATUS_STYLES } from "@/lib/constants";
import GameScoreBanner from "@/components/live/GameScoreBanner";
import LivePickCard from "@/components/live/LivePickCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import ReactionBar from "@/components/challenges/ReactionBar";

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
}) {
  const initial = name.charAt(0).toUpperCase();

  // Build LivePickData[] for the card's picks — only use fallback when live data is loaded
  const picks: LivePickData[] =
    showPicks && card && !liveLoading
      ? card.picks.map((pick) => livePickMap.get(pick.id) ?? toLivePickData(pick))
      : [];

  const statusBadge = card ? (
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
  ) : null;

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Player identity */}
      <div className="flex flex-col items-center gap-2">
        <Avatar
          className={cn(
            "h-14 w-14",
            isWinner && "ring-2 ring-neon-green"
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
        <span className="text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
        {isWinner && (
          <Badge variant="secondary" className="bg-neon-green/15 text-neon-green border-neon-green/30">
            Winner
          </Badge>
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
        />
      ) : (
        <p className="text-center text-xs text-muted-foreground">No card yet</p>
      )}
    </div>
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

  // Live stats polling — enabled when either card is locked
  const hasLockedCards =
    challenge.challenger_card?.status === "locked" ||
    challenge.opponent_card?.status === "locked";

  const { data: liveData, isLoading: liveLoading } = useLiveChallenge(
    challenge.id,
    hasLockedCards
  );

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
  const challengerName =
    challenge.challenger.display_name || challenge.challenger.username;
  const opponentName =
    challenge.opponent.display_name || challenge.opponent.username;

  // Determine if the current user has submitted their card
  const myCard = isChallenger
    ? challenge.challenger_card
    : challenge.opponent_card;
  const theirCard = isChallenger
    ? challenge.opponent_card
    : challenge.challenger_card;
  const otherPlayerName = isChallenger ? opponentName : challengerName;

  // Determine pick visibility: show picks when status is active or resolved
  const showPicks =
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
      <Link
        href="/challenges"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Challenges
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Challenge Matchup
          </h1>
          <Badge
            variant="secondary"
            className={CHALLENGE_STATUS_STYLES[challenge.status] ?? ""}
          >
            {challenge.status.charAt(0).toUpperCase() + challenge.status.slice(1)}
          </Badge>
          {liveData?.has_live_games && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-bold text-primary">LIVE</span>
            </div>
          )}
          {liveLoading && !liveData && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <span className="text-sm text-muted-foreground">{date}</span>
      </div>

      {/* Live Game Scores */}
      {liveData && liveData.games.length > 0 && (
        <GameScoreBanner games={liveData.games} />
      )}

      {/* Error */}
      {error && (
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
      )}

      {/* Winner Banner (resolved only) */}
      {challenge.status === "resolved" && (
        <Card
          className={cn(
            "border",
            isDraw
              ? "border-border bg-muted/10"
              : challenge.winner_id === currentUserId
                ? "border-neon-green/30 bg-neon-green/10"
                : "border-bold-red/30 bg-bold-red/10"
          )}
        >
          <CardContent className="py-3 text-center text-sm font-semibold">
            {isDraw
              ? "It's a draw!"
              : challenge.winner_id === currentUserId
                ? "You won this challenge!"
                : `${otherPlayerName} won this challenge`}
          </CardContent>
        </Card>
      )}

      {/* Reactions — resolved challenges only */}
      {challenge.status === "resolved" && (
        <div className="flex justify-center">
          <ReactionBar
            targetType="challenge"
            targetId={challenge.id}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Matchup Layout — no wrapper card, just the two sides */}
      <div className="flex flex-col items-stretch gap-6 md:flex-row md:gap-4">
        {/* Challenger Side */}
        <PlayerSide
          label="Challenger"
          name={challengerName}
          avatarUrl={challenge.challenger.avatar_url}
          card={challenge.challenger_card}
          isWinner={challengerIsWinner}
          showPicks={showPicks}
          livePickMap={challengerLivePickMap}
          hasLiveGames={liveData?.challenger_card?.has_live_games ?? false}
          liveLoading={hasLockedCards && !liveData}
        />

        {/* VS badge */}
        <div className="flex shrink-0 items-center justify-center md:self-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            VS
          </div>
        </div>

        {/* Opponent Side */}
        <PlayerSide
          label="Opponent"
          name={opponentName}
          avatarUrl={challenge.opponent.avatar_url}
          card={challenge.opponent_card}
          isWinner={opponentIsWinner}
          showPicks={showPicks}
          livePickMap={opponentLivePickMap}
          hasLiveGames={liveData?.opponent_card?.has_live_games ?? false}
          liveLoading={hasLockedCards && !liveData}
        />
      </div>

      {/* Status-specific CTAs */}
      {challenge.status === "pending" && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            {isChallenger ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Waiting for <span className="font-semibold text-foreground">{opponentName}</span> to accept
                </p>
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
      )}

      {challenge.status === "accepted" && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              {!myCard ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Time to make your picks for this challenge!
                  </p>
                  <Link href={`/props?challenge_id=${challenge.id}`}>
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
      )}

      {challenge.status === "active" && (
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
      )}
    </div>
  );
}
