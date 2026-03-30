"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChallengeDetail, ChallengeParticipantProfile } from "@/lib/challenges/queries";
import { useLiveChallenge } from "@/lib/challenges/use-live-challenge";
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
import { ArrowLeft, AlertCircle, Loader2, Crown, Trophy, Check, Clock, Lock, X, UserPlus } from "lucide-react";
import TrashTalkBubble from "@/components/challenges/TrashTalkBubble";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import ShareButton from "@/components/ui/ShareButton";
import ReactionBar from "@/components/challenges/ReactionBar";
import { parseIconConfig } from "@/lib/icons/parse";
import { formatPlacement } from "@/lib/challenges/display";
import type { GameMode } from "@/lib/modes/types";
import { maskEmail } from "@/lib/format";
import { SlideUp, ScaleIn, FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

interface GroupLobbyViewProps {
  challenge: ChallengeDetail;
  currentUserId: string;
}

/* ---------- Helpers ---------- */

function getParticipantDisplayName(
  participant: ChallengeParticipantProfile,
): string {
  if (participant.display_name || participant.username) {
    return participant.display_name || participant.username || "Unknown";
  }
  if (participant.email) return maskEmail(participant.email);
  return "Invited";
}

const statusConfig: Record<string, { label: string; style: string; icon?: "lock" | "clock" | "check" }> = {
  active: { label: "Locked In", style: "bg-neon-green/15 text-neon-green", icon: "lock" },
  accepted: { label: "Accepted", style: "bg-amber-500/15 text-amber-400", icon: "check" },
  invited: { label: "Invited", style: "bg-muted/15 text-muted-foreground", icon: "clock" },
  declined: { label: "Declined", style: "bg-bold-red/15 text-bold-red" },
};

function PlacementBadge({ placement }: { placement: number }) {
  const ordinal = formatPlacement(placement);

  const colorClass =
    placement === 1
      ? "text-neon-green"
      : placement === 2
        ? "text-amber-400"
        : placement === 3
          ? "text-orange-400"
          : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-1 text-sm font-bold", colorClass)}>
      {placement === 1 && <Trophy className="h-4 w-4" />}
      {ordinal}
    </div>
  );
}

/** Build picks with live overlays from card data. */
function buildPicksFromCard(
  card: ChallengeParticipantProfile["card"],
  livePickMap: Map<string, LivePickData>,
): LivePickData[] {
  if (!card) return [];
  return card.picks.map((pick) => {
    const live = livePickMap.get(pick.id);
    if (!live) return toLivePickData(pick);
    const fallback = toLivePickData(pick);
    return {
      ...live,
      current_value: live.current_value ?? fallback.current_value,
      trending: live.trending ?? fallback.trending,
    };
  });
}

/* ---------- Compact Roster Tile ---------- */

function RosterTile({
  participant,
  isCurrentUser,
  isResolved,
  onKick,
}: {
  participant: ChallengeParticipantProfile;
  isCurrentUser: boolean;
  isResolved: boolean;
  onKick?: () => void;
}) {
  const name = getParticipantDisplayName(participant);
  const card = participant.card;
  const cfg = statusConfig[participant.status] ?? statusConfig.invited;

  return (
    <Card className={cn(
      "overflow-hidden border-border bg-card",
      isCurrentUser && "ring-1 ring-primary/30",
      isResolved && participant.placement === 1 && "ring-1 ring-neon-green/30",
    )}>
      <CardContent className="flex items-center gap-3 p-3">
        {/* Avatar */}
        {participant.user_id ? (
          <UserAvatar
            avatarUrl={participant.avatar_url}
            iconConfig={parseIconConfig(participant.icon_config)}
            userId={participant.user_id}
            username={participant.username ?? undefined}
            size={36}
            className={isResolved && participant.placement === 1 ? "animate-winner-ring" : undefined}
          />
        ) : (
          <OpponentAvatar
            opponent={null}
            opponentEmail={participant.email}
            displayName={name}
            size={36}
          />
        )}

        {/* Name + status */}
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            {isResolved && participant.placement === 1 && (
              <Crown className="h-3.5 w-3.5 shrink-0 text-neon-green" />
            )}
            <span className="truncate text-sm font-semibold">
              {name}
            </span>
            {isCurrentUser && (
              <span className="shrink-0 text-[10px] text-muted-foreground">(You)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isResolved && participant.placement !== null ? (
              <PlacementBadge placement={participant.placement} />
            ) : (
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", cfg.style)}>
                {cfg.label}
              </Badge>
            )}
            {participant.is_creator && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Host
              </span>
            )}
          </div>
        </div>

        {/* Right indicator */}
        <div className="flex shrink-0 items-center gap-1.5">
          {card && card.status === "resolved" ? (
            <span className="text-sm font-bold tabular-nums text-foreground">
              {card.score}/{card.total_picks}
            </span>
          ) : card && card.status === "locked" ? (
            <Check className="h-4 w-4 text-neon-green" />
          ) : participant.status === "invited" || participant.status === "accepted" ? (
            <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
          ) : null}
          {onKick && (
            <button
              onClick={onKick}
              className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Remove from challenge"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Participant Pick Section ---------- */

function ParticipantPickSection({
  participant,
  isCurrentUser,
  showPicks,
  livePickMap,
  hasLiveGames,
  liveLoading,
  isResolved,
}: {
  participant: ChallengeParticipantProfile;
  isCurrentUser: boolean;
  showPicks: boolean;
  livePickMap: Map<string, LivePickData>;
  hasLiveGames: boolean;
  liveLoading: boolean;
  isResolved: boolean;
}) {
  const name = getParticipantDisplayName(participant);
  const card = participant.card;

  const sectionLabel = (
    <div className="flex items-center gap-2">
      {participant.user_id ? (
        <UserAvatar
          avatarUrl={participant.avatar_url}
          iconConfig={parseIconConfig(participant.icon_config)}
          userId={participant.user_id}
          username={participant.username ?? undefined}
          size={24}
          className={isResolved && participant.placement === 1 ? "animate-winner-ring" : undefined}
        />
      ) : (
        <OpponentAvatar
          opponent={null}
          opponentEmail={participant.email}
          displayName={name}
          size={24}
        />
      )}
      <span className="text-sm font-semibold">
        {isCurrentUser ? "Your Picks" : name}
      </span>
      {isResolved && participant.placement !== null && (
        <PlacementBadge placement={participant.placement} />
      )}
    </div>
  );

  // No card yet — show waiting placeholder
  if (!card) {
    return (
      <div className="flex flex-col gap-2">
        {sectionLabel}
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-center gap-2 px-4 py-8">
            <Clock className="h-4 w-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Waiting for picks...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Card exists but picks are hidden (privacy: user hasn't locked yet)
  if (!showPicks && !isCurrentUser) {
    return (
      <div className="flex flex-col gap-2">
        {sectionLabel}
        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-center gap-2 px-4 py-8">
            <Lock className="h-4 w-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Picks hidden until you lock in
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const picks = buildPicksFromCard(card, livePickMap);

  const statusLabel = (
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
  );

  return (
    <div className="flex flex-col gap-2">
      {sectionLabel}
      <LivePickCard
        picks={picks}
        hasLiveGames={hasLiveGames}
        statusLabel={statusLabel}
        loading={liveLoading}
        pickCount={card.picks.length}
        showGameScores={false}
      />
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function GroupLobbyView({
  challenge,
  currentUserId,
}: GroupLobbyViewProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<Array<{ id: string; username: string }>>([]);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const prefersReduced = useReducedMotion();

  const participants = challenge.participants ?? [];
  const currentParticipant = participants.find((p) => p.user_id === currentUserId);
  const isCreator = currentParticipant?.is_creator ?? false;

  // Has the current user locked their card?
  const myCard = currentParticipant?.card ?? null;
  const hasLockedCard = myCard?.status === "locked" || myCard?.status === "resolved";

  // Pick visibility: show other participants' picks only after current user locks in
  const showOtherPicks =
    hasLockedCard || challenge.status === "active" || challenge.status === "resolved";

  // Live stats — poll when the current user has locked their card OR the challenge
  // is resolved. This lets users see live scores as soon as they lock in, even if
  // other participants haven't locked in yet (AP-007).
  const shouldFetchLive =
    hasLockedCard || challenge.status === "resolved";

  const { data: liveData, isLoading: liveLoading, challengeResolved } = useLiveChallenge(
    challenge.id,
    shouldFetchLive
  );

  // Refresh page data when the backend resolves the challenge during live polling
  useEffect(() => {
    if (challengeResolved) {
      router.refresh();
    }
  }, [challengeResolved, router]);

  // Build live pick maps per card from the participants array
  const livePickMapByCardId = new Map<string, Map<string, LivePickData>>();
  if (liveData?.participants) {
    for (const lp of liveData.participants) {
      if (!lp.card) continue;
      const map = new Map<string, LivePickData>();
      for (const pick of lp.card.picks) {
        map.set(pick.pick_id, pick);
      }
      livePickMapByCardId.set(lp.card.card_id, map);
    }
  }

  // Winner detection
  const isResolved = challenge.status === "resolved";
  const winner = isResolved
    ? participants.find((p) => p.placement === 1)
    : null;
  const isWinner = winner?.user_id === currentUserId;

  const challengerName = challenge.challenger.username;

  const date = new Date(challenge.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Visible participants (not declined), sorted: locked-in first, then invited/accepted
  const activeParticipants = participants
    .filter((p) => p.status !== "declined")
    .sort((a, b) => {
      const aLocked = a.status === "active" ? 0 : 1;
      const bLocked = b.status === "active" ? 0 : 1;
      if (aLocked !== bLocked) return aLocked - bLocked;
      // Within each group: creator first, then alphabetical
      if (a.is_creator !== b.is_creator) return a.is_creator ? -1 : 1;
      return getParticipantDisplayName(a).localeCompare(getParticipantDisplayName(b));
    });

  // Sort all active participants: current user first, then by placement or creator
  const sortedPickSections = [...activeParticipants].sort((a, b) => {
    const aIsMe = a.user_id === currentUserId ? 0 : 1;
    const bIsMe = b.user_id === currentUserId ? 0 : 1;
    if (aIsMe !== bIsMe) return aIsMe - bIsMe;
    if (isResolved) {
      return (a.placement ?? 99) - (b.placement ?? 99);
    }
    return (a.is_creator ? 0 : 1) - (b.is_creator ? 0 : 1);
  });

  const pickPropsLink =
    challenge.game_mode === "mirror" || challenge.game_mode === "random"
      ? `/challenges/${challenge.id}/ballot`
      : `/props?challenge_id=${challenge.id}`;

  async function handleAction(action: string) {
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
        throw new Error(data.error ?? `Failed to ${action} challenge`);
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

  async function fetchFriendsForInvite() {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/friends?status=accepted");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.friends ?? []).map(
        (f: { friend_profile: { id: string; username: string } }) => f.friend_profile
      );
      setInviteFriends(list);
    } catch {
      // Non-fatal
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleInvite(userId: string) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to invite");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleKick(userId: string) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove participant");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove participant");
    } finally {
      setActionLoading(false);
    }
  }

  // Count locked-in participants
  const lockedInCount = activeParticipants.filter(
    (p: ChallengeParticipantProfile) => p.status === "active"
  ).length;

  return (
    <div className="flex flex-col gap-5">
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
              Group Challenge
            </h1>
            {challenge.game_mode && (
              <GameModeBadge mode={challenge.game_mode as GameMode} size="lg" showClassic />
            )}
            <ScaleIn delay={0.15} duration={0.3} initialScale={0.7}>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                {activeParticipants.length} players
              </Badge>
            </ScaleIn>
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

      {/* Live Game Scores — only when live polling is active */}
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

      {/* Resolved: reactions, share, result */}
      {isResolved && (
        <FadeIn delay={0.2} duration={0.3}>
          <div className="flex flex-col items-center gap-2">
            <ReactionBar
              targetType="challenge"
              targetId={challenge.id}
              currentUserId={currentUserId}
            />
            <div className="mb-1 flex items-center gap-3">
              <p className="text-sm font-semibold">
                {isWinner ? (
                  <span className="text-neon-green">You won!</span>
                ) : winner ? (
                  <span className="text-bold-red">
                    {getParticipantDisplayName(winner)} won!
                  </span>
                ) : (
                  <span className="text-amber-400">Challenge resolved</span>
                )}
              </p>
              <span className="text-muted-foreground/30">|</span>
              <ShareButton
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/challenges/${challenge.id}/share`}
                title={`Group Challenge - AlternaPick`}
                text={`Check out this ${activeParticipants.length}-player group challenge on AlternaPick!`}
              />
            </div>
          </div>
        </FadeIn>
      )}

      {/* Participant Roster — compact tiles, all same height */}
      <StaggerChildren className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {activeParticipants.map((participant) => {
          const canKick =
            isCreator &&
            !participant.is_creator &&
            participant.user_id !== currentUserId &&
            participant.status !== "active" &&
            !isResolved &&
            challenge.status !== "active";
          return (
            <StaggerItem key={participant.id}>
              <RosterTile
                participant={participant}
                isCurrentUser={participant.user_id === currentUserId}
                isResolved={isResolved}
                onKick={canKick && participant.user_id ? () => handleKick(participant.user_id!) : undefined}
              />
            </StaggerItem>
          );
        })}
      </StaggerChildren>

      {/* Invite friends — available for all participants when lobby isn't full */}
      {!isResolved && challenge.status !== "active" && activeParticipants.length < 8 && (
        <FadeIn delay={0.2} duration={0.3}>
          {!showInvite ? (
            <Button
              variant="outline"
              size="sm"
              className="mx-auto flex gap-1.5"
              onClick={() => {
                setShowInvite(true);
                fetchFriendsForInvite();
              }}
            >
              <UserPlus className="h-4 w-4" />
              Invite Friends
            </Button>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Invite Friends</span>
                  <button
                    onClick={() => { setShowInvite(false); setInviteSearch(""); }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {inviteLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : inviteFriends.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    No friends found. Add friends first!
                  </p>
                ) : (
                  <>
                    {inviteFriends.length >= 5 && (
                      <input
                        type="text"
                        placeholder="Search friends..."
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        className="h-8 rounded-md border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {inviteFriends
                        .filter((f) => {
                          // Exclude already-in-challenge participants
                          const alreadyIn = activeParticipants.some((p) => p.user_id === f.id);
                          if (alreadyIn) return false;
                          // Apply search filter
                          if (!inviteSearch.trim()) return true;
                          return f.username.toLowerCase().includes(inviteSearch.toLowerCase().trim());
                        })
                        .map((friend) => (
                          <button
                            key={friend.id}
                            onClick={() => handleInvite(friend.id)}
                            disabled={actionLoading}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs transition-all",
                              "hover:border-orange-500/50 hover:bg-orange-500/10",
                              actionLoading && "opacity-50",
                            )}
                          >
                            <UserPlus className="h-3 w-3" />
                            {friend.username}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </FadeIn>
      )}

      {/* Status-specific CTAs */}
      {challenge.status === "draft" && isCreator && (
        <FadeIn delay={0.25} duration={0.3}>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Pick your props to send this group challenge
                </p>
                <Link href={pickPropsLink}>
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
              {isCreator ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  {!myCard ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Make your picks while waiting for others to join
                      </p>
                      <Link href={pickPropsLink}>
                        <Button size="sm">Make Your Picks</Button>
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {lockedInCount} of {activeParticipants.length} locked in — challenge activates when everyone locks in
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
              ) : currentParticipant && !myCard ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{challengerName}</span> invited you to a group challenge!
                  </p>
                  <Link href={pickPropsLink}>
                    <Button size="sm">Make Your Picks</Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Picks submitted! Waiting for everyone to lock in
                  </p>
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
                      Time to make your picks for this group challenge!
                    </p>
                    <Link href={pickPropsLink}>
                      <Button size="sm">Make Your Picks</Button>
                    </Link>
                  </>
                ) : !hasLockedCard ? (
                  <p className="text-sm text-muted-foreground">
                    Waiting for everyone to lock in their picks
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {lockedInCount} of {activeParticipants.length} locked in — challenge activates when everyone locks in
                  </p>
                )}
                {isCreator && (
                  <Button
                    onClick={() => handleAction("cancel")}
                    disabled={actionLoading}
                    variant="outline"
                    size="sm"
                  >
                    {actionLoading ? "Cancelling..." : "Cancel Challenge"}
                  </Button>
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
                  All participants have locked in their picks. Results will be revealed
                  once games finish.
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Pick Sections — 2-col grid on desktop so cards sit side-by-side */}
      {sortedPickSections.length > 0 && (
        <FadeIn delay={0.15} duration={0.3}>
          <div className={cn(
            "grid gap-4",
            sortedPickSections.length === 1
              ? "grid-cols-1"
              : "grid-cols-1 md:grid-cols-2",
          )}>
            {sortedPickSections.map((participant) => {
              const isMe = participant.user_id === currentUserId;
              const cardId = participant.card?.id;
              const liveMap = cardId
                ? livePickMapByCardId.get(cardId) ?? new Map<string, LivePickData>()
                : new Map<string, LivePickData>();

              return (
                <ParticipantPickSection
                  key={participant.id}
                  participant={participant}
                  isCurrentUser={isMe}
                  showPicks={isMe || showOtherPicks}
                  livePickMap={liveMap}
                  hasLiveGames={liveData?.has_live_games ?? false}
                  liveLoading={shouldFetchLive && !liveData}
                  isResolved={isResolved}
                />
              );
            })}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
