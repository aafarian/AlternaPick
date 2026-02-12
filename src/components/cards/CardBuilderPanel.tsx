"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { createCard } from "@/lib/cards/api";
import { getAnonymousId } from "@/lib/session/anonymous";
import { CATEGORY_LABELS } from "@/lib/constants";
import { getModeConfig } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/modes/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Lock, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import CardSuccessAnimation from "./CardSuccessAnimation";
import ModeSelector from "./ModeSelector";
import CardSizeSelector from "./CardSizeSelector";

export default function CardBuilderPanel() {
  const router = useRouter();
  const {
    state,
    removePick,
    clearCard,
    setLocking,
    setError,
    setMode,
    setCardSize,
    showSuccess,
    hideSuccess,
    isFull,
  } = useCardBuilder();
  const { picks, isLocking, error, challengeId, challengeOpponent, gameMode, cardSize } = state;
  const redirectRef = useRef<string | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  const handleAnimationDismiss = useCallback(() => {
    hideSuccess();
    clearCard();
    if (redirectRef.current) {
      router.push(redirectRef.current);
      redirectRef.current = null;
    }
  }, [hideSuccess, clearCard, router]);

  if (picks.length === 0 && !challengeId && !state.showSuccess) return null;

  const opponentLabel =
    challengeOpponent?.display_name ?? challengeOpponent?.username ?? null;

  // Mode and size are locked once the first pick is added
  const isLocked = picks.length > 0;

  // Build constrained-mode filter banner info
  const modeConfig = getModeConfig(gameMode);
  let filterBanner: string | null = null;
  if (picks.length > 0) {
    if (modeConfig.constraints.samePlayer) {
      filterBanner = `One Player Mode: All picks must be for ${picks[0].player_name}`;
    } else if (modeConfig.constraints.sameTeam) {
      filterBanner = `One Team Mode: All picks must be from ${picks[0].player_team}`;
    }
  }

  const handleModeSelect = useCallback(
    (mode: GameMode) => {
      setMode(mode);
    },
    [setMode]
  );

  const handleSizeSelect = useCallback(
    (size: number) => {
      setCardSize(size);
    },
    [setCardSize]
  );

  async function handleLockIn() {
    if (!isFull || isLocking) return;

    setLocking(true);
    setError(null);

    try {
      const anonId = getAnonymousId();
      await createCard(
        picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        anonId,
        challengeId,
        gameMode,
        cardSize
      );
      redirectRef.current = challengeId
        ? `/challenges/${challengeId}`
        : "/picks";
      showSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lock in card"
      );
    }
  }

  return (
    <>
      {state.showSuccess && (
        <CardSuccessAnimation onDismiss={handleAnimationDismiss} />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3">
          {/* Challenge banner */}
          {challengeId && opponentLabel && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <span className="text-sm font-semibold text-orange-400">
                Challenge vs. {opponentLabel}
              </span>
            </div>
          )}

          {/* Mode constraint filter banner */}
          {filterBanner && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-1.5">
              <span className="text-sm font-semibold text-neon-green">
                {filterBanner}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Collapsible mode + size settings */}
          {!challengeId && (
            <div className="mb-2">
              <button
                onClick={() => setSettingsExpanded((prev) => !prev)}
                className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {settingsExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
                Card Settings
                {isLocked && (
                  <span className="ml-1 text-[10px] normal-case text-muted-foreground/60">
                    (locked after first pick)
                  </span>
                )}
              </button>

              {settingsExpanded && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:items-end sm:gap-6">
                  <ModeSelector
                    activeMode={gameMode}
                    onSelect={handleModeSelect}
                    disabled={isLocked}
                  />
                  <CardSizeSelector
                    activeSize={cardSize}
                    onSelect={handleSizeSelect}
                    disabled={isLocked}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between gap-2 sm:order-none sm:contents">
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold">
                  {picks.length}/{state.maxPicks} Picks
                </span>
                {gameMode !== "classic" && (
                  <Badge
                    variant="outline"
                    className="border-neon-green/40 text-neon-green"
                  >
                    {modeConfig.icon} {modeConfig.displayName}
                  </Badge>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={clearCard}
                  disabled={isLocking}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleLockIn}
                  disabled={!isFull || isLocking}
                  size="sm"
                  className={cn(
                    "font-bold",
                    isFull && !isLocking && "animate-pulse shadow-[0_0_20px_rgba(0,210,106,0.4)]",
                    challengeId
                      ? "bg-orange-500 text-white hover:bg-orange-600"
                      : ""
                  )}
                >
                  {isLocking ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Locking...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      {challengeId ? "Lock In Challenge" : "Lock In"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Scrollable picks list */}
            <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide">
              {picks.map((pick) => (
                <Badge
                  key={pick.prop_id}
                  variant="secondary"
                  className="shrink-0 gap-1.5 rounded-lg border border-border px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium">
                    {pick.player_name.split(" ").pop()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[pick.stat_category] ?? pick.stat_category}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      pick.selection === "over" ? "text-neon-green" : "text-bold-red"
                    )}
                  >
                    {pick.selection === "over" ? "O" : "U"} {pick.line}
                  </span>
                  <button
                    onClick={() => removePick(pick.prop_id)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${pick.player_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
