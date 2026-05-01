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
  Swords,
  Trophy,
} from "lucide-react";
import type { PickResult } from "@/lib/supabase/types";
import type { SimulationResult } from "@/lib/heatscore/simulate";
import { CATEGORY_SHORT_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Shared helpers
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

interface UserSuggestion { userId: string; username: string }

interface UserCardSummary {
  id: string; score: number; totalPicks: number; cardSize: number; resolvedAt: string;
}

interface UserChallengeSummary {
  id: string; opponent: string; result: "won" | "lost" | "draw"; resolvedAt: string;
}

interface UserData {
  userId: string;
  username: string;
  cards: UserCardSummary[];
  challenges: UserChallengeSummary[];
}

interface ChallengePlayer {
  userId: string | null; username: string | null; cardId: string;
  score: number; totalPicks: number; heatScore: number; qualityBonus: number;
  picks: Array<{
    playerName: string; statCategory: string; line: number; selection: string;
    result: PickResult; actualValue: number | null; notch: number; qualityTokens: number;
  }>;
}

interface ChallengeSimResult {
  challengeId: string; status: string; actualWinner: string | null;
  simulatedWinner: string | null; simulatedWinnerUsername: string | null;
  players: ChallengePlayer[];
}

type SimMode = "card" | "challenge";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HeatScoreAdmin() {
  // User autocomplete
  const [userQuery, setUserQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Simulation state
  const [simMode, setSimMode] = useState<SimMode | null>(null);
  const [simId, setSimId] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [cardResult, setCardResult] = useState<SimulationResult | null>(null);
  const [challengeResult, setChallengeResult] = useState<ChallengeSimResult | null>(null);

  // Debounced user search
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/admin/heatscore/user-cards?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.users) setSuggestions(data.users as UserSuggestion[]);
    } catch { /* ignore */ }
    finally { setSuggestionsLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (userQuery.length >= 2) {
      debounceRef.current = setTimeout(() => searchUsers(userQuery), 300);
    } else { setSuggestions([]); }
    return () => clearTimeout(debounceRef.current);
  }, [userQuery, searchUsers]);

  async function selectUser(user: UserSuggestion) {
    setUserQuery(user.username);
    setSuggestions([]);
    setUserLoading(true);
    setUserData(null);
    clearSim();

    try {
      const res = await fetch(`/api/admin/heatscore/user-cards?userId=${user.userId}`);
      const data = await res.json();
      if (res.ok) setUserData(data as UserData);
    } catch { /* ignore */ }
    finally { setUserLoading(false); }
  }

  function clearSim() {
    setSimMode(null);
    setSimId("");
    setSimError(null);
    setCardResult(null);
    setChallengeResult(null);
  }

  async function simulateCard(cardId: string) {
    clearSim();
    setSimMode("card");
    setSimId(cardId);
    setSimLoading(true);

    try {
      const res = await fetch("/api/admin/heatscore/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId }),
      });
      const data = await res.json();
      if (!res.ok) { setSimError(data.error ?? `Error ${res.status}`); return; }
      setCardResult(data as SimulationResult);
    } catch { setSimError("Network error"); }
    finally { setSimLoading(false); }
  }

  async function simulateChallenge(challengeId: string) {
    clearSim();
    setSimMode("challenge");
    setSimId(challengeId);
    setSimLoading(true);

    try {
      const res = await fetch("/api/admin/heatscore/simulate-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      const data = await res.json();
      if (!res.ok) { setSimError(data.error ?? `Error ${res.status}`); return; }
      setChallengeResult(data as ChallengeSimResult);
    } catch { setSimError("Network error"); }
    finally { setSimLoading(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          HeatScore Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User search */}
        <div className="relative">
          <Input
            value={userQuery}
            onChange={(e) => { setUserQuery(e.target.value); setUserData(null); clearSim(); }}
            placeholder="Search by username..."
            className="text-sm"
          />
          {suggestionsLoading && (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {suggestions.length > 0 && !userData && (
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

        {userLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        )}

        {/* User's cards + challenges */}
        {userData && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{userData.username}</p>

            {/* Solo cards */}
            {userData.cards.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solo Cards</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {userData.cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => simulateCard(card.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 ${
                        simMode === "card" && simId === card.id ? "border-orange-500/50 bg-orange-500/5" : "border-border"
                      }`}
                    >
                      <span className="font-medium tabular-nums">{card.score}/{card.totalPicks} ({card.cardSize}-pick)</span>
                      <span className="text-xs text-muted-foreground">{new Date(card.resolvedAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Challenges */}
            {userData.challenges.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Challenges</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {userData.challenges.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => simulateChallenge(ch.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 ${
                        simMode === "challenge" && simId === ch.id ? "border-orange-500/50 bg-orange-500/5" : "border-border"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Swords className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">vs {ch.opponent}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] ${
                            ch.result === "won" ? "bg-emerald-500/15 text-emerald-500" :
                            ch.result === "lost" ? "bg-red-500/15 text-red-400" :
                            "bg-slate-500/15 text-slate-400"
                          }`}
                        >
                          {ch.result}
                        </Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(ch.resolvedAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {userData.cards.length === 0 && userData.challenges.length === 0 && (
              <p className="text-sm text-muted-foreground">No resolved cards or challenges.</p>
            )}
          </div>
        )}

        {/* Direct ID input */}
        <div className="flex gap-2">
          <Input
            value={simMode ? simId : ""}
            onChange={(e) => { setSimId(e.target.value); clearSim(); }}
            placeholder="Or paste a Card / Challenge UUID"
            className="font-mono text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && simId.trim()) simulateCard(simId.trim());
            }}
          />
          <Button onClick={() => simulateCard(simId.trim())} disabled={simLoading || !simId.trim()} size="sm">
            Card
          </Button>
          <Button onClick={() => simulateChallenge(simId.trim())} disabled={simLoading || !simId.trim()} size="sm" variant="outline">
            Challenge
          </Button>
        </div>

        {simLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Simulating...
          </div>
        )}

        {simError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {simError}
          </div>
        )}

        {/* Card simulation results */}
        {cardResult && <CardSimResults result={cardResult} />}

        {/* Challenge simulation results */}
        {challengeResult && <ChallengeSimResults result={challengeResult} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Card simulation results
// ---------------------------------------------------------------------------

function CardSimResults({ result }: { result: SimulationResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatBox label="Score" value={`${result.score}/${result.totalPicks}`} />
        <StatBox label="Effective" value={`${result.hits}/${result.effectiveSize}`} />
        <StatBox label="Multiplier" value={`${result.heatScoreMultiplier}x`} highlight={result.heatScoreMultiplier >= 1 ? "positive" : "negative"} />
        <StatBox label="Quality" value={`${result.qualityBonus >= 0 ? "+" : ""}${result.qualityBonus}`} highlight={result.qualityBonus > 0 ? "positive" : result.qualityBonus < 0 ? "negative" : undefined} />
        <StatBox label={`Payout (${result.simulatedWager})`} value={`${result.simulatedPayout}`} highlight={result.simulatedPayout > result.simulatedWager ? "positive" : result.simulatedPayout < result.simulatedWager ? "negative" : undefined} />
      </div>
      <PicksTable picks={result.picks} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Challenge simulation results
// ---------------------------------------------------------------------------

function ChallengeSimResults({ result }: { result: ChallengeSimResult }) {
  return (
    <div className="space-y-3">
      {/* Winner */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
        <Trophy className="h-4 w-4 text-orange-400" />
        <span className="text-sm">
          {result.simulatedWinner ? (
            <>
              <span className="font-bold text-emerald-500">{result.simulatedWinnerUsername ?? "Unknown"}</span>
              {" wins"}
              {result.players.length === 2 && result.players[0].score === result.players[1]?.score && (
                <span className="text-muted-foreground"> (HeatScore tiebreaker)</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">True draw</span>
          )}
        </span>
      </div>

      {/* Player cards */}
      {result.players.map((player, idx) => (
        <div key={player.cardId} className="rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
            <span className="text-sm font-bold">
              {idx + 1}. {player.username ?? "Unknown"}
              <span className="ml-2 text-muted-foreground font-normal">{player.score}/{player.totalPicks}</span>
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Q: </span>
              <span className={player.qualityBonus > 0 ? "text-emerald-500 font-bold" : player.qualityBonus < 0 ? "text-red-400 font-bold" : "text-muted-foreground"}>
                {player.qualityBonus >= 0 ? "+" : ""}{player.qualityBonus}
              </span>
              <span className="text-orange-400 font-bold tabular-nums">HS {player.heatScore}</span>
            </div>
          </div>
          <PicksTable picks={player.picks} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared picks table
// ---------------------------------------------------------------------------

interface PickRow {
  playerName: string;
  statCategory: string;
  originalLine?: number;
  line?: number;
  selection: string;
  result: PickResult;
  actualValue: number | null;
  qualityTokens?: number;
}

function PicksTable({ picks }: { picks: PickRow[] }) {
  if (picks.length === 0) return <p className="py-2 text-center text-xs text-muted-foreground">No picks</p>;

  return (
    <table className="w-full text-sm">
      <tbody>
        {picks.map((pick, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="px-3 py-1.5 font-medium">{pick.playerName}</td>
            <td className="px-2 py-1.5 text-xs text-muted-foreground">
              {CATEGORY_SHORT_LABELS[pick.statCategory as keyof typeof CATEGORY_SHORT_LABELS] ?? pick.statCategory}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{pick.originalLine ?? pick.line ?? "—"}</td>
            <td className="px-2 py-1.5 text-center">
              <span className={pick.selection === "over" ? "text-emerald-500" : "text-red-400"}>
                {pick.selection === "over" ? "O" : "U"}
              </span>
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{pick.actualValue ?? "—"}</td>
            <td className="px-2 py-1.5 text-center">{resultBadge(pick.result)}</td>
            {pick.qualityTokens !== undefined && (
              <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${
                pick.qualityTokens > 0 ? "text-emerald-500" : pick.qualityTokens < 0 ? "text-red-400" : "text-muted-foreground"
              }`}>
                {pick.qualityTokens === 0 ? "—" : `${pick.qualityTokens > 0 ? "+" : ""}${pick.qualityTokens}`}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Stat box
// ---------------------------------------------------------------------------

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: "positive" | "negative" }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${
        highlight === "positive" ? "text-emerald-500" : highlight === "negative" ? "text-red-400" : ""
      }`}>{value}</p>
    </div>
  );
}
