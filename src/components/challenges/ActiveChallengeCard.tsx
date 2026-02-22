"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
 * A compact matchup card for active/accepted challenges.
 *
 * Horizontal layout: avatars + names inline with VS indicator,
 * game mode badge, status, and "Make Picks" CTA. Designed for
 * 2-column grid display with minimal dead space.
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
  const router = useRouter();
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
          <CardContent className="flex flex-col gap-2 px-3 py-2.5">
            {/* Top row: game mode badge + live indicator + relative time */}
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
              <span className="text-[11px] text-muted-foreground">
                {relativeTime}
              </span>
            </div>

            {/* Matchup row: inline horizontal — avatar name VS name avatar */}
            <div className="flex items-center justify-between">
              {/* Current user - left side */}
              <div className="flex min-w-0 items-center gap-1.5">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                    {currentUserInitial}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-semibold">
                  {currentUser.username}
                </span>
              </div>

              {/* VS indicator */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                VS
              </div>

              {/* Opponent - right side */}
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-right">
                  {opponent.username}
                </span>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                    {opponentInitial}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Bottom row: status text + Make Picks CTA */}
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
                    className="h-7 px-2.5 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/props?challenge_id=${challenge.id}`);
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
