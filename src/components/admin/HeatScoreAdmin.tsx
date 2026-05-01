"use client";

import { useState } from "react";
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
// User card lookup types
// ---------------------------------------------------------------------------

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

  // User lookup
  const [userQuery, setUserQuery] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userCards, setUserCards] = useState<UserCardsResult | null>(null);

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

  async function handleUserSearch() {
    const trimmed = userQuery.trim();
    if (!trimmed) return;

    setUserLoading(true);
    setUserError(null);
    setUserCards(null);

    try {
      const res = await fetch(
        `/api/admin/heatscore/user-cards?q=${encodeURIComponent(trimmed)}`,
      );

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setUserError("Invalid response from server");
        return;
      }

      if (!res.ok) {
        setUserError((data.error as string) ?? `Error ${res.status}`);
        return;
      }

      setUserCards(data as unknown as UserCardsResult);
    } catch {
      setUserError("Network error");
    } finally {
      setUserLoading(false);
    }
  }

  return (
    <>
      {/* ---- User lookup ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            User Card Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Search by username or email to find a user&apos;s resolved cards, then click one to simulate.
          </p>

          <div className="flex gap-2">
            <Input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Username or email"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUserSearch();
              }}
            />
            <Button onClick={handleUserSearch} disabled={userLoading || !userQuery.trim()}>
              {userLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {userError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {userError}
            </div>
          )}

          {userCards && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {userCards.username} — {userCards.cards.length} resolved card{userCards.cards.length !== 1 ? "s" : ""}
              </p>
              {userCards.cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No resolved cards found.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {userCards.cards.map((card) => (
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

      {/* ---- Rollout settings ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rollout Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use the{" "}
            <a href="/admin/settings" className="underline hover:text-foreground">
              Feature Flags
            </a>{" "}
            page to toggle <code className="text-xs bg-muted px-1 py-0.5 rounded">heatscore_enabled</code> and
            manage the <code className="text-xs bg-muted px-1 py-0.5 rounded">heatscore_allowlist</code>.
          </p>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Card Score" value={`${result.score}/${result.totalPicks}`} />
        <SummaryCard label="Effective Picks" value={`${result.hits}/${result.effectiveSize}`} />
        <SummaryCard
          label="HeatScore"
          value={`${result.heatScoreMultiplier}x`}
          highlight={result.heatScoreMultiplier >= 1 ? "positive" : result.heatScoreMultiplier > 0 ? "neutral" : "negative"}
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
