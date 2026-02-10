"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { CHALLENGE_STATUS_STYLES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ChallengeCardProps {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  actionLoading?: string | null;
  userHasCard?: boolean;
}

function getOpponentInfo(
  challenge: ChallengeWithProfiles,
  currentUserId: string
) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  return {
    isChallenger,
    opponent,
    displayName: opponent.display_name || opponent.username,
    avatarInitial: (opponent.display_name || opponent.username)
      .charAt(0)
      .toUpperCase(),
  };
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
  const { isChallenger, displayName, avatarInitial } = getOpponentInfo(
    challenge,
    currentUserId
  );
  const isLoading = actionLoading === challenge.id;

  const date = new Date(challenge.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link href={`/challenges/${challenge.id}`}>
      <Card className="border-border bg-card transition-all hover:border-border hover:bg-secondary/50">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{displayName}</span>
                <Badge
                  variant="secondary"
                  className={CHALLENGE_STATUS_STYLES[challenge.status] ?? ""}
                >
                  {challenge.status.charAt(0).toUpperCase() + challenge.status.slice(1)}
                </Badge>
                {challenge.status === "resolved" && (
                  <Badge
                    variant="secondary"
                    className={
                      !challenge.winner_id
                        ? "bg-muted/15 text-muted-foreground"
                        : challenge.winner_id === currentUserId
                          ? "bg-neon-green/15 text-neon-green border-neon-green/30"
                          : "bg-bold-red/15 text-bold-red border-bold-red/30"
                    }
                  >
                    {!challenge.winner_id
                      ? "Draw"
                      : challenge.winner_id === currentUserId
                        ? "You Won"
                        : "You Lost"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isChallenger ? "You challenged" : "Challenged you"} &middot;{" "}
                {date}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2"
            onClick={(e) => e.preventDefault()}
          >
            {challenge.status === "pending" && !isChallenger && (
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

            {challenge.status === "pending" && isChallenger && (
              <Button
                onClick={() => onCancel?.(challenge.id)}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? "..." : "Cancel"}
              </Button>
            )}

            {(challenge.status === "accepted" ||
              challenge.status === "active") &&
              (userHasCard ? (
                <Badge variant="secondary" className="bg-neon-green/15 text-neon-green border-neon-green/30">
                  Picks Submitted
                </Badge>
              ) : (
                <Link
                  href={`/props?challenge_id=${challenge.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm">Make Your Picks</Button>
                </Link>
              ))}

            {challenge.status === "resolved" && (
              <span className="text-xs text-muted-foreground">View Details</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
