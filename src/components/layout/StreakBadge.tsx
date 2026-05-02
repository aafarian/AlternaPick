"use client";

import { useState, useEffect } from "react";
import { Flame, Gift, Loader2 } from "lucide-react";

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
 * Shows fire token balance prominently, with streak info on hover.
 */
export default function StreakBadge() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [streakRes, tokenRes] = await Promise.all([
          fetch("/api/streaks"),
          fetch("/api/fire-tokens/balance"),
        ]);

        if (!cancelled) {
          if (streakRes.ok) {
            const data: StreakData = await streakRes.json();
            setStreak(data);
          }
          if (tokenRes.ok) {
            const data = await tokenRes.json();
            setTokens({ balance: data.balance ?? 1000, lifetime: data.lifetime ?? 0, can_claim: data.can_claim ?? false });
          }
        }
      } catch {
        // Fail closed — badge stays hidden
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Don't render until we have token data
  if (!tokens) return null;

  const balance = tokens.balance;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Badge */}
      <button
        type="button"
        className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-sm font-semibold text-orange-400 transition-colors hover:bg-orange-500/20 cursor-default select-none"
        role="status"
        aria-label={`${balance} fire tokens`}
      >
        <Flame className="h-4 w-4" aria-hidden="true" />
        <span className="tabular-nums">{balance}</span>
      </button>

      {/* Hover detail card */}
      {showDetails && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Flame Tokens</span>
              <span className="text-sm font-bold tabular-nums text-orange-400">{balance}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Lifetime Earned</span>
              <span className="text-sm font-bold tabular-nums text-muted-foreground">{tokens?.lifetime ?? 0}</span>
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
            {tokens?.can_claim && (
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
                    } catch { /* ignore */ }
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
            {!tokens?.can_claim && (
              <div className="border-t border-border pt-1">
                <p className="text-[10px] text-muted-foreground text-center">
                  Daily claim used — come back tomorrow!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
