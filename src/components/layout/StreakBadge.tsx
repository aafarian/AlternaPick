"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Flame, Gift, HelpCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import FlameTokensModal from "@/components/onboarding/FlameTokensModal";
import { logWarn } from "@/lib/logger";
import { cn } from "@/lib/utils";

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
  const [showFlameInfo, setShowFlameInfo] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    setShowDetails(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Delay hiding so user can move mouse to the tooltip
    hideTimeoutRef.current = setTimeout(() => setShowDetails(false), 200);
  }, []);

  if (!user || !tokens) return null;

  const balance = tokens.balance;
  const canClaim = tokens.can_claim;

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
        <Flame className="relative h-4 w-4" aria-hidden="true" />
        <span className="relative tabular-nums">{balance.toLocaleString()}</span>
      </button>

      {/* Hover detail card — with invisible bridge to prevent gap */}
      {showDetails && (
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
                          setTokens((prev) => prev ? { ...prev, balance: data.balance, can_claim: false } : prev);
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
                    Daily claim used — come back tomorrow!
                  </p>
                </div>
              )}
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
