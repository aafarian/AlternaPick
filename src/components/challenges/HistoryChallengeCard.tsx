"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTimeAgo } from "@/lib/format";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/modes/types";
import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { ScaleIn } from "@/components/motion";
import { useCardHover } from "@/components/challenges/useCardHover";

interface HistoryChallengeCardProps {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
}

type ChallengeResult = "win" | "loss" | "draw" | "cancelled" | "declined";

function getResult(
  challenge: ChallengeWithProfiles,
  currentUserId: string
): ChallengeResult {
  if (challenge.status === "cancelled") return "cancelled";
  if (challenge.status === "declined") return "declined";
  if (challenge.status === "resolved") {
    if (challenge.winner_id === currentUserId) return "win";
    if (challenge.winner_id !== null) return "loss";
    return "draw";
  }
  // Fallback for any unexpected status
  return "draw";
}

function getResultLabel(result: ChallengeResult): string {
  switch (result) {
    case "win":
      return "WIN";
    case "loss":
      return "LOSS";
    case "draw":
      return "DRAW";
    case "cancelled":
      return "CANCELLED";
    case "declined":
      return "DECLINED";
  }
}

function getResultColors(result: ChallengeResult) {
  switch (result) {
    case "win":
      return {
        border: "border-l-neon-green",
        text: "text-neon-green",
        avatarBg: "bg-neon-green/15 text-neon-green",
      };
    case "loss":
      return {
        border: "border-l-bold-red",
        text: "text-bold-red",
        avatarBg: "bg-bold-red/15 text-bold-red",
      };
    default:
      return {
        border: "border-l-muted-foreground/30",
        text: "text-muted-foreground",
        avatarBg: "bg-muted text-muted-foreground",
      };
  }
}

export default function HistoryChallengeCard({
  challenge,
  currentUserId,
}: HistoryChallengeCardProps) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  const displayName = opponent.display_name || opponent.username;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const { hoverProps, prefersReduced } = useCardHover();

  const result = getResult(challenge, currentUserId);
  const resultLabel = getResultLabel(result);
  const colors = getResultColors(result);
  const modeConfig = GAME_MODES[challenge.game_mode as GameMode];
  const dateLabel = formatTimeAgo(
    challenge.resolved_at ?? challenge.created_at
  );

  return (
    <Link href={`/challenges/${challenge.id}`} className="h-full">
      <motion.div {...hoverProps} className="h-full">
        <Card
          className={cn(
            "h-full border-border border-l-2 bg-card transition-all hover:bg-secondary/50",
            colors.border
          )}
        >
          <CardContent className="flex h-full items-center gap-3 px-3 py-2.5">
            {/* Avatar */}
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback
                className={cn("text-xs font-bold", colors.avatarBg)}
              >
                {avatarInitial}
              </AvatarFallback>
            </Avatar>

            {/* Info column */}
            <div className="min-w-0 flex-1">
              {/* Name + result row */}
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold">
                  {displayName}
                </span>
                <ScaleIn initialScale={0.5} duration={0.35}>
                  <span
                    className={cn("text-[10px] font-bold", colors.text)}
                  >
                    {resultLabel}
                  </span>
                </ScaleIn>
                {challenge.challenger_score != null &&
                  challenge.opponent_score != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {isChallenger
                        ? `${challenge.challenger_score}-${challenge.opponent_score}`
                        : `${challenge.opponent_score}-${challenge.challenger_score}`}
                    </span>
                  )}
              </div>

              {/* Mode + date row */}
              <div className="flex items-center gap-1.5">
                {modeConfig && (
                  <span className="text-xs" title={modeConfig.displayName}>
                    {modeConfig.icon}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {dateLabel}
                </span>
              </div>

              {/* Trash talk preview */}
              {challenge.message && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="mt-0.5 max-w-full truncate text-xs italic text-muted-foreground/60">
                        &ldquo;{challenge.message}&rdquo;
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64">
                      <p className="italic">&ldquo;{challenge.message}&rdquo;</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
