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

interface IncomingChallengeCardProps {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  actionLoading?: string | null;
}

/**
 * Amber-themed banner card for incoming (pending) challenges.
 *
 * Displays the challenger's avatar, name, game mode badge, optional trash talk
 * preview, relative time, and large Accept / Decline CTAs. Applies a shake
 * animation on mount and a hover lift effect — both respecting reduced motion.
 */
export default function IncomingChallengeCard({
  challenge,
  currentUserId,
  onAccept,
  onDecline,
  actionLoading,
}: IncomingChallengeCardProps) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  const displayName = opponent.username;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const isLoading = actionLoading === challenge.id;
  const prefersReduced = useReducedMotion();

  // Relative time formatting
  const relativeTime = formatRelativeTime(new Date(challenge.created_at));

  // Hover lift animation
  const hoverProps = prefersReduced
    ? {}
    : {
        whileHover: {
          y: -2,
          boxShadow: "0 6px 16px rgba(245, 158, 11, 0.15)",
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
            "border-l-2 border-l-amber-500 border-border bg-amber-500/[0.03] transition-all hover:bg-amber-500/[0.06]",
            !prefersReduced && "animate-challenge-shake"
          )}
        >
          <CardContent className="flex items-center gap-3 px-4 py-3">
            {/* Challenger avatar */}
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-amber-500/15 text-amber-400 text-sm font-bold">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>

            {/* Info block */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold">
                  {displayName}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
                  Challenge
                </span>
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
                  {relativeTime}
                </span>
              </div>

              {/* Trash talk preview */}
              {challenge.message && (
                <p className="mt-0.5 max-w-[280px] truncate text-xs italic text-amber-400/70">
                  &ldquo;
                  {challenge.message.length > 60
                    ? challenge.message.slice(0, 60) + "..."
                    : challenge.message}
                  &rdquo;
                </p>
              )}
            </div>

            {/* Accept / Decline actions */}
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(e) => e.preventDefault()}
            >
              <AnimatedButton
                onClick={() => onAccept?.(challenge.id)}
                disabled={isLoading}
                size="sm"
                loading={isLoading}
                loadingText="..."
              >
                Accept
              </AnimatedButton>
              <AnimatedButton
                onClick={() => onDecline?.(challenge.id)}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                Decline
              </AnimatedButton>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

/**
 * Format a date as a relative time string (e.g. "2h ago", "3d ago").
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
