"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { GameMode } from "@/lib/modes/types";

interface QuickActionsProps {
  challengeId: string;
  /** The user on the other side of the challenge */
  opponentId: string;
  /** Current game mode, used to pre-fill the rematch */
  gameMode?: GameMode;
  /** Whether the current user is a participant (should always be true on the detail page) */
  isParticipant: boolean;
  /** Only show for resolved challenges */
  isResolved: boolean;
}

/**
 * Quick action buttons shown after a challenge is resolved:
 * - "GG" sends a fire reaction to the challenge
 * - "Rematch?" navigates to challenge creation pre-filled with the same opponent and mode
 */
export default function QuickActions({
  challengeId,
  opponentId,
  gameMode = "classic",
  isParticipant,
  isResolved,
}: QuickActionsProps) {
  const router = useRouter();
  const [ggSent, setGgSent] = useState(false);
  const [ggLoading, setGgLoading] = useState(false);

  // Only show for resolved challenges where the user is a participant
  if (!isResolved || !isParticipant) return null;

  async function handleGG() {
    if (ggSent || ggLoading) return;
    setGgLoading(true);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "challenge",
          target_id: challengeId,
          emoji: "fire",
        }),
      });
      if (res.ok) {
        setGgSent(true);
      }
    } catch {
      // Silently fail — not critical
    } finally {
      setGgLoading(false);
    }
  }

  function handleRematch() {
    const params = new URLSearchParams({
      create: "true",
      opponent: opponentId,
      mode: gameMode,
    });
    router.push(`/challenges?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        onClick={handleGG}
        disabled={ggSent || ggLoading}
        variant="outline"
        size="sm"
        className={
          ggSent
            ? "border-neon-green/30 bg-neon-green/10 text-neon-green"
            : "border-border"
        }
      >
        {ggSent ? "GG Sent!" : ggLoading ? "..." : "GG"}
      </Button>

      <Button onClick={handleRematch} variant="outline" size="sm">
        Rematch?
      </Button>
    </div>
  );
}
