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
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/modes/types";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "@/lib/motion";
import { ScaleIn } from "@/components/motion";

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

/**
 * Format a date as a relative time string.
 * - < 1h: "Xm ago"
 * - < 24h: "Xh ago"
 * - Yesterday: "Yesterday"
 * - < 7d: "X days ago"
 * - Otherwise: "Jan 15" format
 */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HistoryChallengeCard({
  challenge,
  currentUserId,
}: HistoryChallengeCardProps) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  const displayName = opponent.username;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const prefersReduced = useReducedMotion();

  const result = getResult(challenge, currentUserId);
  const resultLabel = getResultLabel(result);
  const colors = getResultColors(result);
  const modeConfig = GAME_MODES[challenge.game_mode as GameMode];
  const dateLabel = formatRelativeDate(
    challenge.resolved_at ?? challenge.created_at
  );

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
