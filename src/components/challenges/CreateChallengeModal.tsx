"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  GAME_MODE_LIST,
  CARD_SIZES,
  DEFAULT_CARD_SIZE,
  isValidGameMode,
} from "@/lib/modes";
import type { GameMode, CardSize } from "@/lib/modes";
import MirrorPropPicker from "./MirrorPropPicker";
import UserSearchBar from "@/components/friends/UserSearchBar";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
} from "lucide-react";

/* ---------- Types ---------- */

interface Friend {
  id: string;
  friend_profile: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

interface CreateChallengeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-select an opponent (e.g. from rematch) */
  initialOpponentId?: string | null;
  /** Pre-select a game mode (e.g. from rematch) */
  initialMode?: string | null;
}

type Step = "opponent" | "settings" | "mirror_props";

const TRASH_TALK_MAX = 200;

/* ---------- Component ---------- */

export default function CreateChallengeModal({
  open,
  onClose,
  onCreated,
  initialOpponentId,
  initialMode,
}: CreateChallengeModalProps) {
  // Step state
  const [step, setStep] = useState<Step>("opponent");

  // Step 1: Opponent selection
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [search, setSearch] = useState("");

  // Step 2: Game mode + card size + trash talk
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [cardSize, setCardSize] = useState<CardSize>(DEFAULT_CARD_SIZE);
  const [message, setMessage] = useState("");

  // Step 3 (mirror only): Prop selection
  const [mirrorProps, setMirrorProps] = useState<string[]>([]);

  // Shared
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Fetch friends ---------- */

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    setError(null);
    try {
      const res = await fetch("/api/friends?status=accepted");
      if (!res.ok) throw new Error("Failed to load friends");
      const data = await res.json();
      setFriends(data.friends ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  /* ---------- Reset on open ---------- */

  useEffect(() => {
    if (open) {
      fetchFriends();
      setSelectedFriend(null);
      setSearch("");
      setGameMode(
        initialMode && isValidGameMode(initialMode) ? initialMode : "classic"
      );
      setCardSize(DEFAULT_CARD_SIZE);
      setMessage("");
      setMirrorProps([]);
      setError(null);
      // If we have a pre-selected opponent we'll skip to step 2 after friends load
      setStep(initialOpponentId ? "settings" : "opponent");
    }
  }, [open, fetchFriends, initialOpponentId, initialMode]);

  /* ---------- Auto-select initial opponent after friends load ---------- */

  useEffect(() => {
    if (!open || !initialOpponentId || loadingFriends || friends.length === 0) return;
    const match = friends.find(
      (f) => f.friend_profile.id === initialOpponentId
    );
    if (match) {
      setSelectedFriend(match);
    }
  }, [open, initialOpponentId, friends, loadingFriends]);

  /* ---------- Create challenge ---------- */

  const handleCreate = async () => {
    if (!selectedFriend) return;
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        opponent_id: selectedFriend.friend_profile.id,
        game_mode: gameMode,
        card_size: cardSize,
      };
      if (message.trim()) {
        payload.message = message.trim();
      }
      if (gameMode === "mirror" && mirrorProps.length > 0) {
        payload.mirror_props = mirrorProps;
        payload.card_size = mirrorProps.length;
      }

      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create challenge");
      }
      onCreated();
      onClose();
      if (gameMode === "random" || gameMode === "mirror") {
        // Props are pre-selected — go straight to ballot to call over/under
        router.push(`/challenges/${data.challenge.id}/ballot`);
      } else {
        // Redirect challenger to props page to make their picks
        router.push(`/props?challenge_id=${data.challenge.id}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create challenge"
      );
    } finally {
      setCreating(false);
    }
  };

  /* ---------- Navigation helpers ---------- */

  const handleNext = () => {
    if (step === "opponent") {
      setStep("settings");
    } else if (step === "settings") {
      if (gameMode === "mirror") {
        setMirrorProps([]);
        setStep("mirror_props");
      } else {
        handleCreate();
      }
    } else if (step === "mirror_props") {
      handleCreate();
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === "settings") {
      setStep("opponent");
    } else if (step === "mirror_props") {
      setStep("settings");
    }
  };

  /* ---------- Can proceed? ---------- */

  const canProceedFromOpponent = selectedFriend !== null;
  const canProceedFromSettings = true; // Mode + size always have defaults
  const canProceedFromMirror = mirrorProps.length === cardSize;

  const canProceed =
    step === "opponent"
      ? canProceedFromOpponent
      : step === "settings"
        ? canProceedFromSettings
        : canProceedFromMirror;

  /* ---------- Step titles ---------- */

  const stepTitles: Record<Step, string> = {
    opponent: "Choose Opponent",
    settings: "Challenge Settings",
    mirror_props: "Select Mirror Props",
  };

  /* ---------- Filtered friends ---------- */

  const filteredFriends = friends.filter((f) => {
    return f.friend_profile.username.toLowerCase().includes(search.toLowerCase());
  });

  /* ---------- Mode info text for special modes ---------- */

  const getModeHint = (mode: GameMode): string | null => {
    switch (mode) {
      case "sabotage":
        return "In Sabotage mode, you'll pick props for your opponent. Try to pick lines they'll miss!";
      case "mirror":
        return "You'll select the shared props in the next step. Both players pick over/under on the same lines.";
      case "one_player":
        return "Both players must build their card using a single NBA player's props.";
      case "random":
        return "The system randomly selects props for both players. Just call over or under!";
      case "one_team":
        return "Both players must build their card using props from a single NBA team.";
      default:
        return null;
    }
  };

  /* ---------- Render ---------- */

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-card border-border max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== "opponent" && (
              <button
                onClick={handleBack}
                className="rounded-md p-1 transition-colors hover:bg-secondary"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <DialogTitle>{stepTitles[step]}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0 -mx-6 px-6">

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {(["opponent", "settings", ...(gameMode === "mirror" ? ["mirror_props" as Step] : [])] as Step[]).map(
            (s, i, arr) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : arr.indexOf(s) < arr.indexOf(step)
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-6 rounded-full",
                      arr.indexOf(s) < arr.indexOf(step)
                        ? "bg-primary/40"
                        : "bg-secondary"
                    )}
                  />
                )}
              </div>
            )
          )}
        </div>

        {/* ========== STEP 1: Opponent Selection ========== */}
        {step === "opponent" && (
          <>
            <Input
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <ScrollArea className="h-64">
              {loadingFriends ? (
                <div className="flex flex-col gap-2 p-1">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {friends.length === 0 ? (
                    <div className="flex flex-col gap-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        Search for users to add as friends, then challenge them!
                      </p>
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
                  ) : (
                    <p>No friends match your search.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1 p-1">
                  {filteredFriends.map((friend) => {
                    const profile = friend.friend_profile;
                    const name = profile.username;
                    const isSelected = selectedFriend?.friend_profile.id === profile.id;
                    return (
                      <button
                        key={friend.id}
                        onClick={() => setSelectedFriend(friend)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-secondary"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-bold">{name}</div>
                          </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* ========== STEP 2: Mode + Card Size + Trash Talk ========== */}
        {step === "settings" && (
          <div className="flex flex-col gap-5">
            {/* Selected opponent badge */}
            {selectedFriend && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="text-sm font-bold">
                  {selectedFriend.friend_profile.username}
                </span>
              </div>
            )}

            {/* Game Mode Selection */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Game Mode
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {GAME_MODE_LIST.map((mode) => {
                  const isSelected = gameMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      onClick={() => {
                        setGameMode(mode.key);
                        // Reset mirror props when switching away from mirror
                        if (mode.key !== "mirror") {
                          setMirrorProps([]);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:bg-secondary"
                      )}
                    >
                      <span className="text-lg">{mode.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold">{mode.displayName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {mode.description}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Mode hint */}
              {getModeHint(gameMode) && (
                <div className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary/80">
                  {getModeHint(gameMode)}
                </div>
              )}
            </div>

            {/* Card Size Selection */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Card Size
              </p>
              <div className="flex gap-2">
                {CARD_SIZES.map((size) => {
                  const isSelected = cardSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => setCardSize(size)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold transition-all",
                        isSelected
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Number of picks each player will make
              </p>
            </div>

            {/* Trash Talk Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Trash Talk
                </p>
                <Badge variant="secondary" className="text-[9px]">
                  Optional
                </Badge>
              </div>
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => {
                    if (e.target.value.length <= TRASH_TALK_MAX) {
                      setMessage(e.target.value);
                    }
                  }}
                  placeholder="Talk some trash..."
                  rows={2}
                  className={cn(
                    "w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm",
                    "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  )}
                  maxLength={TRASH_TALK_MAX}
                />
                <span
                  className={cn(
                    "absolute bottom-2 right-3 text-[10px] tabular-nums",
                    message.length > TRASH_TALK_MAX * 0.9
                      ? "text-bold-red"
                      : "text-muted-foreground"
                  )}
                >
                  {message.length}/{TRASH_TALK_MAX}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========== STEP 3: Mirror Prop Selection ========== */}
        {step === "mirror_props" && (
          <MirrorPropPicker
            cardSize={cardSize}
            selectedPropIds={mirrorProps}
            onSelectionChange={setMirrorProps}
          />
        )}

        </div>{/* end scrollable content */}

        {/* ========== Footer buttons ========== */}
        <div className="flex gap-3 pt-2 border-t border-border shrink-0">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed || creating}
            className="flex-1 gap-1.5"
          >
            {creating ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : step === "opponent" ? (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            ) : step === "settings" && gameMode === "mirror" ? (
              <>
                Pick Props
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              "Send Challenge"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
