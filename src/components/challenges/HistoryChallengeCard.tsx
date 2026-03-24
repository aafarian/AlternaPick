"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTimeAgo } from "@/lib/format";
import { getOpponentDisplayName, formatPlacement } from "@/lib/challenges/display";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/modes/types";
import { cn } from "@/lib/utils";
import { motion } from "@/lib/motion";
import { ScaleIn } from "@/components/motion";
import { useCardHover } from "@/components/challenges/useCardHover";
import OpponentAvatar from "@/components/challenges/OpponentAvatar";
import StackedAvatars from "@/components/challenges/StackedAvatars";
import { Users } from "lucide-react";

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
      };
    case "loss":
      return {
        border: "border-l-bold-red",
        text: "text-bold-red",
      };
    default:
      return {
        border: "border-l-muted-foreground/30",
        text: "text-muted-foreground",
      };
  }
}

export default function HistoryChallengeCard({
  challenge,
  currentUserId,
}: HistoryChallengeCardProps) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const isGroup = challenge.lobby_type === "group";
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  const displayName = isGroup
    ? `Group (${challenge.participant_count ?? 0} players)`
    : getOpponentDisplayName(opponent, challenge.opponent_email);
  const { hoverProps } = useCardHover();

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
            <div className="shrink-0">
              {isGroup && challenge.participant_avatars ? (
                <StackedAvatars participants={challenge.participant_avatars} size={26} />
              ) : (
                <OpponentAvatar
                  opponent={opponent}
                  opponentEmail={challenge.opponent_email}
                  displayName={displayName}
                  size={32}
                />
              )}
            </div>

            {/* Info column */}
            <div className="min-w-0 flex-1">
              {/* Name + result row */}
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold">
                  {displayName}
                </span>
                {isGroup && challenge.status === "resolved" && challenge.my_placement != null ? (
                  <ScaleIn initialScale={0.5} duration={0.35}>
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        challenge.my_placement === 1 ? "text-neon-green" : "text-muted-foreground"
                      )}
                    >
                      {formatPlacement(challenge.my_placement)} of {challenge.participant_count}
                    </span>
                  </ScaleIn>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Mode + date row */}
              <div className="flex items-center gap-1.5">
                {modeConfig && (
                  <span className="text-xs" title={modeConfig.displayName}>
                    {modeConfig.icon}
                  </span>
                )}
                {isGroup && (
                  <Badge variant="secondary" className="gap-1 bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] px-1 py-0">
                    <Users className="h-2.5 w-2.5" />
                  </Badge>
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
