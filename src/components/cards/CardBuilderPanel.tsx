"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import { X, Lock, Loader2, Swords, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHeatScoreMultiplier } from "@/lib/heatscore/constants";
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
  const { picks, error, challengeId, challengeOpponent, pendingChallenge, gameMode, guestToken } = state;
  const isInChallengeMode = !!(challengeId || pendingChallenge);
  const redirectRef = useRef<string | null>(null);

  // Local locking state — context dispatch doesn't reliably trigger re-renders
  const [isLocking, setIsLocking] = useState(false);
  const [guestLocking, setGuestLocking] = useState(false);

  // Auth gate for guest lock-in
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Fire Token wager (solo ranked mode)
  const [wager, setWager] = useState<number | null>(null);
  const [showHeatPicker, setShowRankedPicker] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Fetch token balance when ranked picker is opened
  useEffect(() => {
    if (!showHeatPicker || tokenBalance !== null) return;

    let cancelled = false;
    setBalanceLoading(true);

    fetch("/api/fire-tokens/balance")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTokenBalance(data.balance ?? 1000);
      })
      .catch(() => {
        if (!cancelled) setTokenBalance(1000);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });

    return () => { cancelled = true; };
  }, [showHeatPicker, tokenBalance]);

  // Reset wager + balance when card is cleared so next card refetches
  useEffect(() => {
    if (picks.length === 0) {
      setWager(null);
      setShowRankedPicker(false);
      setTokenBalance(null);
    }
  }, [picks.length]);

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
      // Force Next.js to re-fetch server component data for the target route
      // so the challenge page shows the freshly-locked card instead of a stale
      // snapshot from the route cache.
      router.refresh();
    }
  }, [hideSuccess, clearCard, router]);

  const handleModeSelect = useCallback(
    (mode: GameMode) => setMode(mode),
    [setMode]
  );

  // Dynamic lock-in label: show pick count when the user has a choice (unconstrained).
  // Constrained opponents already see "3/3" in the counter — just say "Lock In Challenge".
  const pickCountLabel = !state.cardSizeConstrained && picks.length >= 2
    ? `${picks.length}-Pick `
    : "";

  if (picks.length === 0 && !isInChallengeMode && !state.showSuccess) return null;

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
        challengeId: challengeId ?? undefined,
      }));
      setShowAuthModal(true);
      return;
    }

    setIsLocking(true);
    setError(null);

    try {
      let effectiveChallengeId = challengeId;

      // Deferred challenge: create the challenge now, then create the card.
      if (pendingChallenge && !challengeId) {
        const challengePayload: Record<string, unknown> = {
          game_mode: gameMode,
          card_size: picks.length,
          message: pendingChallenge.message || undefined,
        };

        if (pendingChallenge.opponents.length === 1) {
          const opp = pendingChallenge.opponents[0];
          if (opp.email) {
            challengePayload.opponent_email = opp.email;
          } else if (opp.user_id) {
            challengePayload.opponent_id = opp.user_id;
          }
        } else {
          challengePayload.opponents = pendingChallenge.opponents;
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
        effectiveChallengeId = challengeData.challenge.id;

        // Clean up sessionStorage
        sessionStorage.removeItem("pending_challenge");
      }

      await createCard(
        picks.map((p) => ({ prop_id: p.prop_id, selection: p.selection })),
        undefined,
        effectiveChallengeId,
        gameMode,
        picks.length,
        effectiveChallengeId ? null : wager,
      );
      redirectRef.current = effectiveChallengeId
        ? `/challenges/${effectiveChallengeId}`
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
        redirectTo={
          guestToken && challengeId
            ? `/challenges/${challengeId}/guest?token=${guestToken}`
            : isInChallengeMode && challengeId
              ? `/challenges/${challengeId}`
              : undefined
        }
      />

      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 md:bottom-0">
        {/* Challenge picker panel — sits ABOVE the bar */}
        {showChallengePicker && (
          <div className="border-t border-orange-500/30 bg-surface/95 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 py-2.5">
              {/* Row 1: Mode pills (60%) + trash talk (40%) */}
              <div className="mb-2 flex items-center gap-2">
                <div className="min-w-0 basis-3/5">
                  <ModeSelector
                    activeMode={gameMode}
                    onSelect={handleModeSelect}
                    compact
                    modes={["classic", "sabotage", "mirror", "one_player", "one_team"]}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Trash talk..."
                  value={challengeMessage}
                  onChange={(e) => setChallengeMessage(e.target.value.slice(0, 200))}
                  className="h-8 min-w-0 basis-2/5 rounded-md border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Row 2: Friend selection + send */}
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {loadingFriends ? (
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-secondary" />
                      ))}
                    </div>
                  ) : friends.length === 0 ? (
                    <UserSearchBar
                      onSendRequest={async (username) => {
                        await fetch("/api/friends", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ username }),
                        });
                      }}
                    />
                  ) : (() => {
                    const query = friendSearch.toLowerCase().trim();
                    const filtered = query
                      ? friends.filter((f) =>
                          f.username.toLowerCase().includes(query)
                        )
                      : friends;
                    return (
                      <div className="flex items-center gap-2">
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
                          <div className="flex gap-1.5 overflow-x-auto pb-2 -mb-2 scrollbar-thin">
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
                      </div>
                    );
                  })()}
                </div>

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

        {/* Heat Mode wager picker panel — sits ABOVE the bar (like challenge picker) */}
        {showHeatPicker && !isInChallengeMode && (
          <div className="border-t border-orange-500/30 bg-surface/95 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 py-2.5">
              {/* Row 1: Wager input + quick presets + balance */}
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 shrink-0 text-orange-400" />

                {balanceLoading ? (
                  <div className="h-8 w-20 animate-pulse rounded-md bg-secondary" />
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={10}
                        max={tokenBalance ?? 1000}
                        value={wager ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setWager(null);
                            return;
                          }
                          const num = parseInt(val, 10);
                          if (!isNaN(num) && num >= 0) {
                            setWager(Math.min(num, tokenBalance ?? 1000));
                          }
                        }}
                        placeholder="0"
                        className="h-8 w-20 rounded-md border border-orange-500/40 bg-background px-2.5 text-sm font-bold tabular-nums text-orange-400 placeholder:text-muted-foreground/40 focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-1">
                      {[25, 50, 100].map((amt) => {
                        const isDisabled = tokenBalance !== null && tokenBalance < amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setWager(amt)}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-bold transition-colors",
                              wager === amt
                                ? "bg-orange-500/20 text-orange-400"
                                : isDisabled
                                  ? "cursor-not-allowed text-muted-foreground/30"
                                  : "bg-muted text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400",
                            )}
                          >
                            {amt}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        disabled={!tokenBalance}
                        onClick={() => setWager(tokenBalance ?? 0)}
                        className={cn(
                          "rounded-md px-2 py-1 text-[11px] font-bold transition-colors",
                          wager === tokenBalance
                            ? "bg-orange-500/20 text-orange-400"
                            : !tokenBalance
                              ? "cursor-not-allowed text-muted-foreground/30"
                              : "bg-muted text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400",
                        )}
                      >
                        MAX
                      </button>
                    </div>

                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      🔥 {tokenBalance ?? 1000} available
                    </span>
                  </>
                )}
              </div>

              {/* Row 2: Payout preview for current card size */}
              {wager != null && wager >= 10 && picks.length >= 2 && (
                <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-thin">
                  {Array.from({ length: picks.length + 1 }, (_, k) => picks.length - k)
                    .filter((hits) => {
                      const mult = getHeatScoreMultiplier(hits, picks.length);
                      return mult > 0 || hits === picks.length || hits === 0;
                    })
                    .map((hits) => {
                      const mult = getHeatScoreMultiplier(hits, picks.length);
                      const payout = Math.round(wager * mult);
                      const net = payout - wager;
                      const isPerfect = hits === picks.length;
                      return (
                        <div
                          key={hits}
                          className={cn(
                            "flex shrink-0 flex-col items-center rounded-md border px-2.5 py-1",
                            isPerfect
                              ? "border-orange-500/40 bg-orange-500/10"
                              : net > 0
                                ? "border-emerald-500/20 bg-emerald-500/5"
                                : net === 0
                                  ? "border-border bg-muted/30"
                                  : "border-border bg-card",
                          )}
                        >
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {hits}/{picks.length}
                          </span>
                          <span className={cn(
                            "text-xs font-bold tabular-nums",
                            isPerfect
                              ? "text-orange-400"
                              : net > 0
                                ? "text-emerald-500"
                                : net < 0
                                  ? "text-red-400"
                                  : "text-muted-foreground",
                          )}>
                            {mult > 0 ? `${mult}x` : "BUST"}
                          </span>
                          {mult > 0 && (
                            <span className={cn(
                              "text-[10px] tabular-nums",
                              net > 0 ? "text-emerald-500" : net < 0 ? "text-red-400" : "text-muted-foreground",
                            )}>
                              {net >= 0 ? "+" : ""}{net}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main bottom bar */}
        <div className="border-t border-border bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-3">
            {/* Challenge banner — existing challenge context */}
            {isInChallengeMode && opponentLabel && (
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
                {isInChallengeMode ? (
                  /* Challenge mode — single Lock In button */
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
                        Lock In {pickCountLabel}Challenge
                      </>
                    )}
                  </Button>
                ) : (
                  /* Regular card — Solo lock-in + Heat Mode toggle + Challenge */
                  <>
                    <Button
                      onClick={handleLockIn}
                      disabled={!canLockIn || isLocking || creatingChallenge}
                      size="sm"
                      className={cn(
                        "font-bold",
                        wager != null
                          ? "bg-orange-500 text-white hover:bg-orange-600"
                          : "",
                        isLocking && "opacity-70",
                        canLockIn && !isLocking && !creatingChallenge && (
                          wager != null
                            ? "animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                            : "animate-pulse shadow-[0_0_20px_rgba(0,210,106,0.4)]"
                        ),
                      )}
                    >
                      {isLocking ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Locking...
                        </>
                      ) : wager != null ? (
                        <>
                          <Flame className="mr-1.5 h-3.5 w-3.5" />
                          Wager {wager} — Lock In
                        </>
                      ) : (
                        <>
                          <Lock className="mr-1.5 h-3.5 w-3.5" />
                          Lock In {pickCountLabel}Solo
                        </>
                      )}
                    </Button>
                    {user && !showHeatPicker && (
                      <>
                        <span className="text-xs text-muted-foreground">or</span>
                        <Button
                          onClick={() => {
                            if (showChallengePicker) {
                              setShowChallengePicker(false);
                            } else {
                              setShowChallengePicker(true);
                              setShowRankedPicker(false);
                              setWager(null);
                              fetchFriendsForChallenge();
                            }
                          }}
                          disabled={isLocking}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "font-bold border-orange-500/40 text-orange-400 hover:bg-orange-500/10",
                            showChallengePicker && "bg-orange-500/10",
                          )}
                        >
                          <Swords className="mr-1.5 h-3.5 w-3.5" />
                          Challenge
                        </Button>
                      </>
                    )}
                    {user && !showChallengePicker && (
                      <>
                        {!showHeatPicker && (
                          <span className="text-xs text-muted-foreground">or</span>
                        )}
                        <Button
                          onClick={() => {
                            if (showHeatPicker) {
                              setShowRankedPicker(false);
                              setWager(null);
                            } else {
                              setShowRankedPicker(true);
                              setShowChallengePicker(false);
                            }
                          }}
                          disabled={isLocking}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "font-bold",
                            showHeatPicker
                              ? "border-muted-foreground/40 text-muted-foreground hover:bg-muted/50"
                              : "border-orange-500/40 text-orange-400 hover:bg-orange-500/10",
                          )}
                        >
                          {showHeatPicker ? (
                            <>
                              <Lock className="mr-1.5 h-3.5 w-3.5" />
                              Casual
                            </>
                          ) : (
                            <>
                              <Flame className="mr-1.5 h-3.5 w-3.5" />
                              Heat Mode
                            </>
                          )}
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
                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-thin">
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
