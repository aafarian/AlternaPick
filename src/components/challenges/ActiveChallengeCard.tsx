"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import type { GameMode } from "@/lib/modes/types";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "@/lib/motion";
import { formatTimeAgo } from "@/lib/format";

interface ActiveChallengeCardProps {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
  userHasCard?: boolean;
  actionLoading?: string | null;
}

/**
 * A mini-matchup card for active/accepted challenges.
 *
 * Shows both players' avatars facing each other with a "VS" indicator,
 * game mode badge, status text, and a "Make Picks" CTA when the user
 * hasn't submitted a card yet.
 *
 * Applies pulsing glow animation via `animate-active-glow` and a hover
 * lift effect. Both respect `prefers-reduced-motion`.
 */
export default function ActiveChallengeCard({
  challenge,
  currentUserId,
  userHasCard = false,
  actionLoading,
}: ActiveChallengeCardProps) {
  const prefersReduced = useReducedMotion();
  const isLoading = actionLoading === challenge.id;

  const isChallenger = challenge.challenger_id === currentUserId;
  const currentUser = isChallenger ? challenge.challenger : challenge.opponent;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;

  const currentUserInitial = currentUser.username.charAt(0).toUpperCase();
  const opponentInitial = opponent.username.charAt(0).toUpperCase();

  // Determine status text
  const isActive = challenge.status === "active";
  const statusText = isActive ? "Challenge is live!" : "Waiting for picks";

  const relativeTime = formatTimeAgo(challenge.created_at);

  // Hover lift animation
  const hoverProps = prefersReduced
    ? {}
    : {
        whileHover: {
          y: -1,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        },
        transition: {
          type: "spring" as const,
          stiffness: 400,
          damping: 30,
        },
      };

  return (
    <Link href={`/challenges/${challenge.id}`}>
      <motion.div {...hoverProps}>
        <Card
          className={cn(
            "border-border transition-all hover:bg-secondary/50",
            !prefersReduced && "animate-active-glow"
          )}
        >
          <CardContent className="flex flex-col gap-3 px-4 py-3">
            {/* Top row: game mode badge + relative time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {challenge.game_mode && (
                  <GameModeBadge
                    mode={challenge.game_mode as GameMode}
                    size="md"
                    showClassic
                  />
                )}
                <div className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase text-primary">
                    {isActive ? "Live" : "Active"}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {relativeTime}
              </span>
            </div>

            {/* Matchup row: avatar VS avatar */}
            <div className="flex items-center justify-center gap-3">
              {/* Current user - left side */}
              <div className="flex flex-col items-center gap-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                    {currentUserInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[80px] truncate text-xs font-semibold">
                  {currentUser.username}
                </span>
              </div>

              {/* VS indicator */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                VS
              </div>

              {/* Opponent - right side */}
              <div className="flex flex-col items-center gap-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                    {opponentInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[80px] truncate text-xs font-semibold">
                  {opponent.username}
                </span>
              </div>
            </div>

            {/* Status text + Make Picks CTA */}
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-neon-green" : "text-muted-foreground"
                )}
              >
                {statusText}
              </span>

              {!userHasCard && (
                <div onClick={(e) => e.preventDefault()}>
                  <AnimatedButton
                    size="sm"
                    disabled={isLoading}
                    loading={isLoading}
                    loadingText="..."
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/props?challenge_id=${challenge.id}`;
                    }}
                  >
                    Make Picks
                  </AnimatedButton>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
