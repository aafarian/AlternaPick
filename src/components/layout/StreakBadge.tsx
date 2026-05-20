"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Gift, HelpCircle, Loader2, Check, Circle } from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import { useAuth } from "@/lib/auth/auth-context";
import FlameTokensModal from "@/components/onboarding/FlameTokensModal";
import { logWarn } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { QuestKey } from "@/lib/heatscore/constants";

interface StreakData {
  daily_streak: number;
  best_daily_streak: number;
  freezes_available: number;
  next_freeze_reset: string | null;
}

interface TokenData {
  balance: number;
  lifetime: number;
  can_claim: boolean;
}

/**
 * Combined Flame Token + Streak badge for the header.
 * Shows flame token balance prominently, with streak info on hover.
 */
export default function StreakBadge() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimAnimation, setClaimAnimation] = useState<number | null>(null);
  const [showFlameInfo, setShowFlameInfo] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Quest state
  interface QuestItem { key: QuestKey; label: string; reward: number; completed: boolean; claimed: boolean }
  const [quests, setQuests] = useState<QuestItem[] | null>(null);
  const [questsLoading, setQuestsLoading] = useState(false);
  const questsFetchedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    Promise.all([
      fetch("/api/streaks").then((r) => r.ok ? r.json() : null),
      fetch("/api/fire-tokens/balance").then((r) => r.ok ? r.json() : null),
    ]).then(([streakData, tokenData]) => {
      if (cancelled) return;
      if (streakData) setStreak(streakData);
      // Always set tokens — use defaults if API failed
      setTokens({
        balance: tokenData?.balance ?? 0,
        lifetime: tokenData?.lifetime ?? 0,
        can_claim: tokenData?.can_claim ?? false,
      });
    }).catch((err) => {
      logWarn("streak-badge", "Failed to fetch streak/token data", err);
      // Network error — show badge with 0 so it's never invisible
      if (!cancelled) setTokens({ balance: 0, lifetime: 0, can_claim: false });
    });

    return () => { cancelled = true; };
  }, [user]);

  // Re-fetch balance when a wager is placed or tokens change
  useEffect(() => {
    function refreshBalance() {
      fetch("/api/fire-tokens/balance")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setTokens((prev) => prev ? {
              ...prev,
              balance: data.balance ?? prev.balance,
              can_claim: data.can_claim ?? prev.can_claim,
            } : prev);
          }
        })
        .catch((err) => logWarn("streak-badge", "Failed to refresh balance", err));
    }
    window.addEventListener("flame-tokens-changed", refreshBalance);
    return () => window.removeEventListener("flame-tokens-changed", refreshBalance);
  }, []);

  const fetchQuests = useCallback(async () => {
    if (questsFetchedRef.current || questsLoading) return;
    setQuestsLoading(true);
    try {
      const res = await fetch("/api/quests");
      if (!res.ok) return;
      const data = await res.json();
      setQuests(data.quests);

      // Show toasts for newly claimed quests
      for (const claimed of data.newlyClaimed ?? []) {
        toast.success(`Quest complete: ${claimed.key === "all_complete" ? "All quests" : data.quests.find((q: QuestItem) => q.key === claimed.key)?.label} +${claimed.reward}`);
        // Refresh balance
        window.dispatchEvent(new Event("flame-tokens-changed"));
      }

      questsFetchedRef.current = true;
    } catch (err) {
      logWarn("streak-badge", "Failed to fetch quests", err);
    } finally {
      setQuestsLoading(false);
    }
  }, [questsLoading]);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    setShowDetails(true);
    fetchQuests();
  }, [fetchQuests]);

  const handleMouseLeave = useCallback(() => {
    // Delay hiding so user can move mouse to the tooltip
    hideTimeoutRef.current = setTimeout(() => setShowDetails(false), 200);
  }, []);

  if (!user) return null;

  const loading = !tokens;
  const balance = tokens?.balance ?? 0;
  const canClaim = tokens?.can_claim ?? false;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Badge */}
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold cursor-default select-none text-orange-400",
          canClaim
            ? "animate-flame-claim"
            : "bg-orange-500/10 hover:bg-orange-500/20",
        )}
        role="status"
        aria-label={`${balance.toLocaleString()} flame tokens${canClaim ? " — daily claim available" : ""}`}
      >
        <FlameTokenIcon className="relative h-4 w-4" aria-hidden="true" />
        {loading ? (
          <Loader2 className="relative h-3 w-3 animate-spin" />
        ) : (
          <span className="relative tabular-nums">{balance.toLocaleString()}</span>
        )}
      </button>

      {/* Claim animation — floating +50 */}
      {claimAnimation != null && (
        <span
          className="absolute -top-1 left-1/2 -translate-x-1/2 text-sm font-black text-emerald-500 animate-[claim-float_1.5s_ease-out_forwards] pointer-events-none"
        >
          +{claimAnimation}
        </span>
      )}

      {/* Hover detail card — with invisible bridge to prevent gap */}
      {showDetails && !loading && (
        <>
          {/* Invisible bridge between badge and card */}
          <div className="absolute right-0 top-full z-50 h-2 w-full" />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Flame Tokens</span>
                <span className="text-sm font-bold tabular-nums text-orange-400">{balance}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Lifetime Earned</span>
                <span className="text-sm font-bold tabular-nums text-muted-foreground">{tokens.lifetime}</span>
              </div>
              {streak && streak.daily_streak > 0 && (
                <>
                  <div className="border-t border-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Daily Streak</span>
                    <span className="text-sm font-bold tabular-nums text-primary">{streak.daily_streak} 🔥</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Best Streak</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{streak.best_daily_streak}</span>
                  </div>
                  {streak.freezes_available > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Freezes</span>
                      <span className="text-sm tabular-nums text-sky-400">{streak.freezes_available} ❄️</span>
                    </div>
                  )}
                </>
              )}
              {canClaim && (
                <>
                  <div className="border-t border-border" />
                  <button
                    type="button"
                    disabled={claiming}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setClaiming(true);
                      try {
                        const res = await fetch("/api/fire-tokens/claim", { method: "POST" });
                        const data = await res.json();
                        if (res.ok) {
                          const newBalance = data.balance;
                          // Animate the count-up
                          setClaimAnimation(data.claimed ?? 50);
                          setTokens((prev) => prev ? { ...prev, balance: newBalance, can_claim: false } : prev);
                          // Clear the animation after it plays
                          setTimeout(() => setClaimAnimation(null), 2000);
                        }
                      } catch (err) { logWarn("streak-badge", "Daily claim failed", err); }
                      finally { setClaiming(false); }
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-orange-500/15 px-2 py-1.5 text-xs font-bold text-orange-400 transition-colors hover:bg-orange-500/25"
                  >
                    {claiming ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Gift className="h-3 w-3" />
                        Claim Daily +50
                      </>
                    )}
                  </button>
                </>
              )}
              {!canClaim && (
                <div className="border-t border-border pt-1">
                  <p className="text-[10px] text-muted-foreground text-center">
                    Daily claim used - come back tomorrow!
                  </p>
                </div>
              )}

              {/* Daily Quests */}
              <div className="border-t border-border pt-2">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Daily Quests
                </p>
                {questsLoading || !quests ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {quests.map((q) => (
                      <div
                        key={q.key}
                        className={cn(
                          "flex items-center gap-1.5 rounded px-1.5 py-1 text-[10px]",
                          q.key === "all_complete" && "mt-0.5 border border-amber-500/20 bg-amber-500/5",
                          q.completed && q.key !== "all_complete" && "opacity-60",
                        )}
                      >
                        {q.completed ? (
                          <Check className="h-3 w-3 shrink-0 text-neon-green" />
                        ) : (
                          <Circle className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                        )}
                        <span className={cn("flex-1", q.completed && "line-through")}>
                          {q.label}
                        </span>
                        <span className={cn(
                          "shrink-0 font-bold tabular-nums",
                          q.completed ? "text-neon-green" : "text-muted-foreground",
                        )}>
                          +{q.reward}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFlameInfo(true);
                    setShowDetails(false);
                  }}
                  className="flex w-full items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <HelpCircle className="h-3 w-3" />
                  What are Flame Tokens?
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <FlameTokensModal open={showFlameInfo} onClose={() => setShowFlameInfo(false)} />
    </div>
  );
}
