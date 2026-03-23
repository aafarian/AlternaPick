"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { createCard } from "@/lib/cards/api";
import { getAnonymousId } from "@/lib/session/anonymous";
import { getModeConfig } from "@/lib/modes/definitions";
import { validatePicksForMode } from "@/lib/modes/validation";
import type { GameMode } from "@/lib/modes/types";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Lock, Loader2, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import CardSuccessAnimation from "./CardSuccessAnimation";
import AuthRequiredModal from "./AuthRequiredModal";
import ModeSelector from "./ModeSelector";
import UserSearchBar from "@/components/friends/UserSearchBar";

interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function CardBuilderPanel() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    state,
    removePick,
    clearCard,
    setError,
    setMode,
    showSuccess,
    hideSuccess,
    canLockIn,
  } = useCardBuilder();
  const { picks, error, challengeId, challengeOpponent, gameMode, guestToken } = state;
  const redirectRef = useRef<string | null>(null);

  // Local locking state — context dispatch doesn't reliably trigger re-renders
  const [isLocking, setIsLocking] = useState(false);
  const [guestLocking, setGuestLocking] = useState(false);

  // Auth gate for guest lock-in
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Challenge-a-friend state
  const [showChallengePicker, setShowChallengePicker] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);


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
      if (creatingChallenge) return;

      if (picks.length < 2) {
        setError("You need at least 2 picks to send a challenge");
        return;
      }

      // Validate picks against the selected mode before creating
      const validation = validatePicksForMode(
        picks.map((p) => ({ player_name: p.player_name, player_team: p.player_team })),
        gameMode
      );
      if (!validation.valid) {
        setError(validation.error ?? "Picks don't match the selected game mode");
        return;
      }

      const size = picks.length;
      setCreatingChallenge(true);
      setError(null);
      try {
        const challengePayload: Record<string, unknown> = {
            opponent_id: opponentId,
            game_mode: gameMode,
            card_size: size,
            message: challengeMessage.trim() || undefined,
        };
        // Mirror mode: pass current prop IDs as the shared props
        if (gameMode === "mirror") {
          challengePayload.mirror_props = picks.map((p) => p.prop_id);
          challengePayload.card_size = picks.length;
        }
        const challengeRes = await fetch("/api/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(challengePayload),
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
          size
        );

        setShowChallengePicker(false);
        setChallengeMessage("");
        setFriendSearch("");
        setSelectedFriendId(null);
        redirectRef.current = `/challenges/${newChallengeId}`;
        showSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send challenge");
      } finally {
        setCreatingChallenge(false);
      }
    },
    [creatingChallenge, picks, gameMode, challengeMessage, setError, showSuccess]
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

  if (picks.length === 0 && !challengeId && !state.showSuccess) return null;

  const opponentLabel = challengeOpponent?.username ?? null;

  // Constraint banner — for constrained modes (one_player/one_team)
  const modeConfig = getModeConfig(gameMode);
  let filterBanner: string | null = null;
  if (picks.length > 0) {
    if (modeConfig.constraints.samePlayer) {
      filterBanner = `One Player Mode: All picks must be for ${picks[0].player_name}`;
    } else if (modeConfig.constraints.sameTeam) {
      filterBanner = `One Team Mode: All picks must be from ${picks[0].player_team}`;
    }
  }

  async function handleGuestLockIn() {
    if (!challengeId || !guestToken || guestLocking) return;
    setGuestLocking(true);
    setError(null);

    try {
      const res = await fetch(`/api/challenges/${challengeId}/guest-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: guestToken,
          picks: picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit guest picks");
      }

      setShowAuthModal(false);
      redirectRef.current = `/challenges/${challengeId}/guest?token=${guestToken}`;
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock in card");
    } finally {
      setGuestLocking(false);
    }
  }

  async function handleLockIn() {
    if (!canLockIn || isLocking) return;

    // Guest users: save picks and show auth modal
    if (!user) {
      sessionStorage.setItem("pending_card_picks", JSON.stringify({
        picks: picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        gameMode,
        cardSize: picks.length,
      }));
      setShowAuthModal(true);
      return;
    }

    setIsLocking(true);
    setError(null);

    try {
      await createCard(
        picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        undefined,
        challengeId,
        gameMode,
        picks.length
      );
      redirectRef.current = challengeId
        ? `/challenges/${challengeId}`
        : "/picks";
      showSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lock in card"
      );
    } finally {
      setIsLocking(false);
    }
  }

  return (
    <>
      {state.showSuccess && (
        <CardSuccessAnimation onDismiss={handleAnimationDismiss} />
      )}

      <AuthRequiredModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        pickCount={picks.length}
        onGuestLockIn={guestToken ? handleGuestLockIn : undefined}
        guestLoading={guestLocking}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {/* Challenge picker panel — sits ABOVE the bar */}
        {showChallengePicker && (
          <div className="border-t border-orange-500/30 bg-surface/95 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 py-2.5">
              {/* Row 1: Mode pills */}
              <div className="mb-2">
                <ModeSelector
                  activeMode={gameMode}
                  onSelect={handleModeSelect}
                  compact
                  modes={["classic", "sabotage", "mirror", "one_player", "one_team"]}
                />
              </div>

              {/* Row 2: Friends + trash talk + send */}
              <div className="flex items-center gap-2">
                {/* Friend selection */}
                {loadingFriends ? (
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-secondary" />
                    ))}
                  </div>
                ) : friends.length === 0 ? (
                  <div className="flex-1 min-w-0">
                    <UserSearchBar
                      onSendRequest={async (username) => {
                        await fetch("/api/friends", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ username }),
                        });
                      }}
                    />
                  </div>
                ) : (() => {
                  const query = friendSearch.toLowerCase().trim();
                  const filtered = query
                    ? friends.filter((f) =>
                        f.username.toLowerCase().includes(query)
                      )
                    : friends;
                  return (
                    <>
                      {/* Search — only if 5+ friends */}
                      {friends.length >= 5 && (
                        <input
                          type="text"
                          placeholder="Search..."
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          className="h-8 w-28 shrink-0 rounded-md border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
                        />
                      )}
                      {filtered.length === 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">No match</span>
                      ) : (
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                          {filtered.map((friend) => {
                            const name = friend.username;
                            const isSelected = selectedFriendId === friend.id;
                            return (
                              <button
                                key={friend.id}
                                onClick={() => setSelectedFriendId(isSelected ? null : friend.id)}
                                disabled={creatingChallenge}
                                className={cn(
                                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all",
                                  isSelected
                                    ? "border-orange-500 bg-orange-500/15 text-orange-400"
                                    : "border-border bg-card hover:border-orange-500/50 hover:bg-orange-500/10",
                                  creatingChallenge && "opacity-50"
                                )}
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className={cn(
                                    "text-[9px] font-bold",
                                    isSelected ? "bg-orange-500/20 text-orange-400" : "bg-primary/10 text-primary"
                                  )}>
                                    {name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-bold">{name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="h-5 w-px shrink-0 bg-border" />

                {/* Trash talk */}
                <input
                  type="text"
                  placeholder="Trash talk..."
                  value={challengeMessage}
                  onChange={(e) => setChallengeMessage(e.target.value.slice(0, 200))}
                  className="h-8 w-32 shrink-0 rounded-md border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
                />

                {/* Send button */}
                <Button
                  onClick={() => {
                    if (selectedFriendId) handleChallengeFromPicks(selectedFriendId);
                  }}
                  disabled={!selectedFriendId || picks.length < 2 || creatingChallenge}
                  size="sm"
                  className={cn(
                    "shrink-0 font-bold",
                    selectedFriendId && picks.length >= 2 && !creatingChallenge
                      ? "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_0_16px_rgba(249,115,22,0.3)]"
                      : ""
                  )}
                >
                  {creatingChallenge ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Swords className="mr-1.5 h-3.5 w-3.5" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main bottom bar */}
        <div className="border-t border-border bg-surface/80 backdrop-blur-xl">
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

            {/* Constraint filter banner */}
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

            {/* Actions row */}
            <div className="flex items-center gap-3">
              {/* CTA buttons — LEFT side */}
              <div className="flex shrink-0 items-center gap-2">
                {challengeId ? (
                  /* Existing challenge — single Lock In button */
                  <Button
                    onClick={handleLockIn}
                    disabled={!canLockIn || isLocking}
                    size="sm"
                    className={cn(
                      "font-bold",
                      isLocking
                        ? "bg-orange-500/70 text-white"
                        : "bg-orange-500 text-white hover:bg-orange-600",
                      canLockIn && !isLocking && "animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.4)]",
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
                        Lock In Challenge
                      </>
                    )}
                  </Button>
                ) : (
                  /* Regular card — Solo + Challenge split */
                  <>
                    <Button
                      onClick={handleLockIn}
                      disabled={!canLockIn || isLocking || creatingChallenge}
                      size="sm"
                      className={cn(
                        "font-bold",
                        isLocking
                          ? "opacity-70"
                          : "",
                        canLockIn && !isLocking && !creatingChallenge && "animate-pulse shadow-[0_0_20px_rgba(0,210,106,0.4)]",
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
                          Lock In Solo
                        </>
                      )}
                    </Button>
                    {user && (
                      <>
                        <span className="text-xs text-muted-foreground">or</span>
                        <Button
                          onClick={() => {
                            if (showChallengePicker) {
                              setShowChallengePicker(false);
                            } else {
                              setShowChallengePicker(true);
                              fetchFriendsForChallenge();
                            }
                          }}
                          disabled={isLocking}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "font-bold border-orange-500/40 text-orange-400 hover:bg-orange-500/10",
                            showChallengePicker && "bg-orange-500/10"
                          )}
                        >
                          <Swords className="mr-1.5 h-3.5 w-3.5" />
                          Challenge
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Pick count + Clear — middle */}
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold">
                  {picks.length}/{state.maxPicks}
                </span>
                <Button
                  onClick={clearCard}
                  disabled={isLocking || creatingChallenge}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              </div>

              {/* Scrollable picks — fills remaining space */}
              {picks.length > 0 && (
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-hide">
                  {picks.map((pick) => (
                    <Badge
                      key={pick.prop_id}
                      variant="secondary"
                      className="shrink-0 gap-1 rounded-lg border border-border px-2 py-1"
                    >
                      <span className="text-[11px] font-medium">
                        {pick.player_name.split(" ").pop()}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-bold",
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
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
