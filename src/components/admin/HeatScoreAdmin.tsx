"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  AlertTriangle,
  Search,
  User,
} from "lucide-react";
import type { PickResult } from "@/lib/supabase/types";
import type { SimulationResult } from "@/lib/heatscore/simulate";
import { CATEGORY_SHORT_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESULT_BADGE_STYLES: Record<string, string> = {
  hit: "bg-emerald-500/15 text-emerald-500 border-emerald-600/20",
  miss: "bg-red-500/15 text-red-400 border-red-600/20",
  push: "bg-slate-500/15 text-slate-400 border-slate-600/20",
  dnp: "bg-slate-500/15 text-slate-400 border-slate-600/20",
  pending: "bg-amber-500/15 text-amber-400 border-amber-600/20",
};

function resultBadge(result: PickResult) {
  const label = result === "dnp" ? "DNP" : result.charAt(0).toUpperCase() + result.slice(1);
  return <Badge className={RESULT_BADGE_STYLES[result] ?? RESULT_BADGE_STYLES.pending}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSuggestion {
  userId: string;
  username: string;
}

interface UserCardSummary {
  id: string;
  score: number;
  totalPicks: number;
  cardSize: number;
  resolvedAt: string;
}

interface UserCardsResult {
  userId: string;
  username: string;
  cards: UserCardSummary[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HeatScoreAdmin() {
  const [cardId, setCardId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // User autocomplete
  const [userQuery, setUserQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserCardsResult | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced user search
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/admin/heatscore/user-cards?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.users) {
        setSuggestions(data.users as UserSuggestion[]);
      }
    } catch {
      // Silently fail autocomplete — not critical
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (userQuery.length >= 2) {
      debounceRef.current = setTimeout(() => searchUsers(userQuery), 300);
    } else {
      setSuggestions([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [userQuery, searchUsers]);

  async function selectUser(user: UserSuggestion) {
    setUserQuery(user.username);
    setSuggestions([]);
    setCardsLoading(true);
    setSelectedUser(null);

    try {
      const res = await fetch(`/api/admin/heatscore/user-cards?userId=${user.userId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedUser(data as UserCardsResult);
      }
    } catch {
      // ignore
    } finally {
      setCardsLoading(false);
    }
  }

  async function handleSimulate(id?: string) {
    const trimmed = (id ?? cardId).trim();
    if (!trimmed) return;

    setCardId(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/heatscore/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: trimmed }),
      });

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setError("Invalid response from server");
        return;
      }

      if (!res.ok) {
        setError((data.error as string) ?? `Error ${res.status}`);
        return;
      }

      setResult(data as unknown as SimulationResult);
    } catch {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ---- User lookup with autocomplete ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            User Card Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setSelectedUser(null);
              }}
              placeholder="Search by username..."
              className="text-sm"
            />
            {suggestionsLoading && (
              <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}

            {/* Autocomplete dropdown */}
            {suggestions.length > 0 && !selectedUser && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                {suggestions.map((user) => (
                  <button
                    key={user.userId}
                    type="button"
                    onClick={() => selectUser(user)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50 first:rounded-t-md last:rounded-b-md"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {user.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          {cardsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading cards...
            </div>
          )}

          {selectedUser && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {selectedUser.username} — {selectedUser.cards.length} resolved card{selectedUser.cards.length !== 1 ? "s" : ""}
              </p>
              {selectedUser.cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No resolved cards found.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {selectedUser.cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSimulate(card.id)}
                      className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium tabular-nums">
                        {card.score}/{card.totalPicks} ({card.cardSize}-pick)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(card.resolvedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Simulator ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Card HeatScore Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="Card UUID"
              className="font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSimulate();
              }}
            />
            <Button onClick={() => handleSimulate()} disabled={loading || !cardId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simulate"}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && <SimulationResults result={result} />}
        </CardContent>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Simulation results
// ---------------------------------------------------------------------------

function SimulationResults({ result }: { result: SimulationResult }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Card Score" value={`${result.score}/${result.totalPicks}`} />
        <SummaryCard label="Effective Picks" value={`${result.hits}/${result.effectiveSize}`} />
        <SummaryCard
          label="HeatScore"
          value={`${result.heatScoreMultiplier}x`}
          highlight={result.heatScoreMultiplier >= 1 ? "positive" : result.heatScoreMultiplier > 0 ? "neutral" : "negative"}
        />
        <SummaryCard
          label="Quality Bonus"
          value={`${result.qualityBonus >= 0 ? "+" : ""}${result.qualityBonus}`}
          highlight={result.qualityBonus > 0 ? "positive" : result.qualityBonus < 0 ? "negative" : "neutral"}
        />
        <SummaryCard
          label={`Payout (${result.simulatedWager} wager)`}
          value={`${result.simulatedPayout}`}
          highlight={result.simulatedPayout > result.simulatedWager ? "positive" : result.simulatedPayout < result.simulatedWager ? "negative" : "neutral"}
        />
      </div>

      {/* Per-pick breakdown */}
      {result.picks.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No picks on this card.</p>
      ) : !result.picks.some((p) => p.result === "hit" || p.result === "miss") ? (
        <p className="py-4 text-center text-sm text-muted-foreground">All picks are DNP or push — no scoreable picks.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium">Player</th>
                <th className="px-3 py-2 text-left font-medium">Stat</th>
                <th className="px-3 py-2 text-right font-medium">Line</th>
                <th className="px-3 py-2 text-center font-medium">Pick</th>
                <th className="px-3 py-2 text-right font-medium">Actual</th>
                <th className="px-3 py-2 text-center font-medium">Result</th>
                <th className="px-3 py-2 text-right font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {result.picks.map((pick) => (
                <tr key={pick.pickId} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-medium">{pick.playerName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {CATEGORY_SHORT_LABELS[pick.statCategory] ?? pick.statCategory}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{pick.originalLine}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={pick.selection === "over" ? "text-emerald-500" : "text-red-400"}>
                      {pick.selection === "over" ? "O" : "U"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {pick.actualValue !== null ? pick.actualValue : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">{resultBadge(pick.result)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                    pick.qualityTokens > 0
                      ? "text-emerald-500"
                      : pick.qualityTokens < 0
                        ? "text-red-400"
                        : "text-muted-foreground"
                  }`}>
                    {pick.qualityTokens === 0 ? "—" : `${pick.qualityTokens > 0 ? "+" : ""}${pick.qualityTokens}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          highlight === "positive"
            ? "text-emerald-500"
            : highlight === "negative"
              ? "text-red-400"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
