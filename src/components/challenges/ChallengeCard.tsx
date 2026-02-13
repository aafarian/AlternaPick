"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import type { GameMode } from "@/lib/modes/types";
import { cn } from "@/lib/utils";

interface ChallengeCardProps {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  actionLoading?: string | null;
  userHasCard?: boolean;
}

export default function ChallengeCard({
  challenge,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
  actionLoading,
  userHasCard = false,
}: ChallengeCardProps) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  const displayName = opponent.display_name || opponent.username;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const isLoading = actionLoading === challenge.id;

  const isActive =
    challenge.status === "active" || challenge.status === "accepted";
  const isResolved = challenge.status === "resolved";
  const isPending = challenge.status === "pending";
  const isIncoming = isPending && !isChallenger;
  const isOutgoing = isPending && isChallenger;
  const won = isResolved && challenge.winner_id === currentUserId;
  const lost =
    isResolved &&
    challenge.winner_id !== null &&
    challenge.winner_id !== currentUserId;

  // Left border + card background
  const borderClass = isIncoming
    ? "border-l-2 border-l-amber-500"
    : won
      ? "border-l-2 border-l-neon-green"
      : lost
        ? "border-l-2 border-l-bold-red"
        : "";

  const bgClass = isIncoming ? "bg-amber-500/[0.03]" : "bg-card";

  const date = new Date(challenge.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link href={`/challenges/${challenge.id}`}>
      <Card
        className={cn(
          "border-border transition-all hover:bg-secondary/50",
          borderClass,
          bgClass
        )}
      >
        <CardContent className="flex items-center gap-3 px-4 py-2.5">
          {/* Avatar */}
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback
              className={cn(
                "text-sm font-bold",
                isIncoming
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-primary/10 text-primary"
              )}
            >
              {avatarInitial}
            </AvatarFallback>
          </Avatar>

          {/* Info — name row has inline status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold">{displayName}</span>

              {/* Inline status indicator */}
              {isActive && (
                <div className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="text-[10px] font-bold text-primary">ACTIVE</span>
                </div>
              )}
              {won && (
                <span className="text-[10px] font-bold text-neon-green">WIN</span>
              )}
              {lost && (
                <span className="text-[10px] font-bold text-bold-red">LOSS</span>
              )}
              {isResolved && !challenge.winner_id && (
                <span className="text-[10px] font-bold text-muted-foreground">DRAW</span>
              )}
              {isOutgoing && (
                <span className="text-[10px] font-medium text-muted-foreground/60">WAITING</span>
              )}
              {(challenge.status === "cancelled" || challenge.status === "declined") && (
                <span className="text-[10px] font-medium text-muted-foreground/60">
                  {challenge.status === "cancelled" ? "CANCELLED" : "DECLINED"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {challenge.game_mode && (
                <GameModeBadge
                  mode={challenge.game_mode as GameMode}
                  size="md"
                  showClassic
                />
              )}
              <span className="text-xs text-muted-foreground">
                {isIncoming
                  ? "Challenged you"
                  : isOutgoing
                    ? "You challenged"
                    : isChallenger
                      ? "You challenged"
                      : "Challenged you"}{" "}
                &middot; {date}
              </span>
            </div>
            {/* Trash talk — more prominent on incoming */}
            {challenge.message && (
              <p
                className={cn(
                  "mt-0.5 max-w-[280px] truncate text-xs italic",
                  isIncoming
                    ? "text-amber-400/70"
                    : "text-muted-foreground/60"
                )}
              >
                &ldquo;
                {challenge.message.length > 60
                  ? challenge.message.slice(0, 60) + "..."
                  : challenge.message}
                &rdquo;
              </p>
            )}
          </div>

          {/* Right side — actions only */}
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.preventDefault()}
          >
            {/* Incoming: Accept / Decline */}
            {isIncoming && (
              <>
                <Button
                  onClick={() => onAccept?.(challenge.id)}
                  disabled={isLoading}
                  size="sm"
                >
                  {isLoading ? "..." : "Accept"}
                </Button>
                <Button
                  onClick={() => onDecline?.(challenge.id)}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  Decline
                </Button>
              </>
            )}

            {/* Outgoing: Make Picks + Cancel */}
            {isOutgoing && (
              <>
                {!userHasCard && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/props?challenge_id=${challenge.id}`;
                    }}
                  >
                    Make Picks
                  </Button>
                )}
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel?.(challenge.id);
                  }}
                  disabled={isLoading}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  {isLoading ? "..." : "Cancel"}
                </Button>
              </>
            )}

            {/* Active: Make Picks if needed */}
            {isActive && !userHasCard && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/props?challenge_id=${challenge.id}`;
                }}
              >
                Make Picks
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
