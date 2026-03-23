"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedButton } from "@/components/ui/animated-button";
import UserAvatar from "@/components/icons/UserAvatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import { useCardHover } from "@/components/challenges/useCardHover";
import { parseIconConfig } from "@/lib/icons/parse";
import type { GameMode } from "@/lib/modes/types";
import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { formatTimeAgo } from "@/lib/format";

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
  const displayName = opponent?.display_name || opponent?.username || challenge.opponent_email || "Invited";
  const isLoading = actionLoading === challenge.id;
  const { hoverProps, prefersReduced } = useCardHover(
    -2,
    "0 6px 16px rgba(245, 158, 11, 0.15)"
  );

  const relativeTime = formatTimeAgo(challenge.created_at);

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
            <div className="shrink-0">
              <UserAvatar
                avatarUrl={opponent?.avatar_url ?? null}
                iconConfig={parseIconConfig(opponent?.icon_config ?? null)}
                userId={opponent?.id ?? ""}
                username={opponent?.username ?? displayName}
                size={40}
              />
            </div>

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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="mt-0.5 max-w-[280px] truncate text-xs italic text-amber-400/70">
                        &ldquo;{challenge.message}&rdquo;
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64">
                      <p className="italic">
                        &ldquo;{challenge.message}&rdquo;
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
