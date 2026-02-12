"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { createCard } from "@/lib/cards/api";
import { getAnonymousId } from "@/lib/session/anonymous";
import { CATEGORY_LABELS } from "@/lib/constants";
import { getModeConfig } from "@/lib/modes/definitions";
import { validatePicksForMode } from "@/lib/modes/validation";
import type { GameMode } from "@/lib/modes/types";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Lock, Loader2, Swords, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import CardSuccessAnimation from "./CardSuccessAnimation";
import ModeSelector from "./ModeSelector";
import CardSizeSelector from "./CardSizeSelector";

interface FriendProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function CardBuilderPanel() {
  const router = useRouter();
  const { user } = useAuth();
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

  // Challenge-a-friend state
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  const fetchFriendsForChallenge = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/friends?status=accepted");
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.friends ?? []).map((f: { friend_profile: FriendProfile }) => f.friend_profile);
      setFriends(list);
    } catch {
      // ignore
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const handleChallengeFromPicks = useCallback(
    async (opponentId: string) => {
      if (!isFull || creatingChallenge) return;

      // Validate picks against the selected mode before creating
      const validation = validatePicksForMode(
        picks.map((p) => ({ player_name: p.player_name, player_team: p.player_team })),
        gameMode
      );
      if (!validation.valid) {
        setError(validation.error ?? "Picks don't match the selected game mode");
        return;
      }

      setCreatingChallenge(true);
      setError(null);
      try {
        const challengeRes = await fetch("/api/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opponent_id: opponentId,
            game_mode: gameMode,
            card_size: cardSize,
            message: challengeMessage.trim() || undefined,
          }),
        });
        const challengeData = await challengeRes.json();
        if (!challengeRes.ok) {
          throw new Error(challengeData.error ?? "Failed to create challenge");
        }
        const newChallengeId = challengeData.challenge.id;

        const anonId = getAnonymousId();
        await createCard(
          picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
          anonId,
          newChallengeId,
          gameMode,
          cardSize
        );

        setShowChallengePicker(false);
        setChallengeMessage("");
        redirectRef.current = `/challenges/${newChallengeId}`;
        showSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send challenge");
      } finally {
        setCreatingChallenge(false);
      }
    },
    [isFull, creatingChallenge, picks, gameMode, cardSize, challengeMessage, setError, showSuccess]
  );

  const handleAnimationDismiss = useCallback(() => {
    hideSuccess();
    clearCard();
    if (redirectRef.current) {
      router.push(redirectRef.current);
      redirectRef.current = null;
    }
  }, [hideSuccess, clearCard, router]);

  const handleModeSelect = useCallback(
    (mode: GameMode) => setMode(mode),
    [setMode]
  );

  const handleSizeSelect = useCallback(
    (size: number) => setCardSize(size),
    [setCardSize]
  );

  if (picks.length === 0 && !challengeId && !state.showSuccess) return null;

  const opponentLabel =
    challengeOpponent?.display_name ?? challengeOpponent?.username ?? null;

  // Constraint banner — only for existing challenges with constrained modes
  const modeConfig = getModeConfig(gameMode);
  let filterBanner: string | null = null;
  if (challengeId && picks.length > 0) {
    if (modeConfig.constraints.samePlayer) {
      filterBanner = `One Player Mode: All picks must be for ${picks[0].player_name}`;
    } else if (modeConfig.constraints.sameTeam) {
      filterBanner = `One Team Mode: All picks must be from ${picks[0].player_team}`;
    }
  }

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
          {/* Challenge banner — existing challenge context */}
          {challengeId && opponentLabel && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5">
              <span className="text-sm font-semibold text-orange-400">
                Challenge vs. {opponentLabel}
              </span>
              {gameMode !== "classic" && (
                <Badge variant="outline" className="border-orange-500/40 text-orange-400">
                  {modeConfig.icon} {modeConfig.displayName}
                </Badge>
              )}
            </div>
          )}

          {/* Constraint filter banner — existing challenges only */}
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between gap-2 sm:order-none sm:contents">
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold">
                  {picks.length}/{state.maxPicks} Picks
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={clearCard}
                  disabled={isLocking || creatingChallenge}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
                {/* Challenge a Friend — only for non-challenge cards when user is logged in */}
                {!challengeId && user && !showChallengePicker && (
                  <Button
                    onClick={() => {
                      setShowChallengePicker(true);
                      fetchFriendsForChallenge();
                    }}
                    disabled={!isFull || isLocking}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "font-bold",
                      isFull && "border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                    )}
                  >
                    <Swords className="mr-1.5 h-3.5 w-3.5" />
                    Challenge
                  </Button>
                )}
                <Button
                  onClick={handleLockIn}
                  disabled={!isFull || isLocking || creatingChallenge}
                  size="sm"
                  className={cn(
                    "font-bold",
                    isFull && !isLocking && !creatingChallenge && "animate-pulse shadow-[0_0_20px_rgba(0,210,106,0.4)]",
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

            {/* Challenge picker — includes mode/size settings */}
            {showChallengePicker && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowChallengePicker(false)}
                      className="rounded-md p-1 transition-colors hover:bg-secondary"
                    >
                      <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <span className="text-sm font-bold text-orange-400">
                      Challenge a Friend
                    </span>
                  </div>
                </div>

                {/* Mode + Size selectors */}
                <div className="mb-3 flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:items-end sm:gap-6">
                  <ModeSelector
                    activeMode={gameMode}
                    onSelect={handleModeSelect}
                  />
                  <CardSizeSelector
                    activeSize={cardSize}
                    onSelect={handleSizeSelect}
                  />
                </div>

                {/* Optional trash talk */}
                <input
                  type="text"
                  placeholder="Talk some trash... (optional)"
                  value={challengeMessage}
                  onChange={(e) => setChallengeMessage(e.target.value.slice(0, 200))}
                  className="mb-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
                />

                {/* Friend list */}
                {loadingFriends ? (
                  <div className="flex gap-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 w-24 animate-pulse rounded-lg bg-secondary" />
                    ))}
                  </div>
                ) : friends.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No friends to challenge. Add friends first!</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {friends.map((friend) => {
                      const name = friend.display_name || friend.username;
                      return (
                        <button
                          key={friend.id}
                          onClick={() => handleChallengeFromPicks(friend.id)}
                          disabled={creatingChallenge}
                          className={cn(
                            "flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-all hover:border-orange-500/50 hover:bg-orange-500/10",
                            creatingChallenge && "opacity-50"
                          )}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                              {name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-bold">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {creatingChallenge && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-orange-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Sending challenge...
                  </div>
                )}
              </div>
            )}

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
