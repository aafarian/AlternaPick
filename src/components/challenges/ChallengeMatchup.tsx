"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChallengeDetail } from "@/lib/challenges/queries";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { StatCategory } from "@/lib/supabase/types";

interface ChallengeMatchupProps {
  challenge: ChallengeDetail;
  currentUserId: string;
}

/* ---------- Shared sub-components ---------- */

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    accepted: "bg-blue-500/20 text-blue-400",
    active: "bg-green-500/20 text-green-400",
    resolved: "bg-purple-500/20 text-purple-400",
    declined: "bg-red-500/20 text-red-400",
    cancelled: "bg-muted/20 text-muted",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] ?? "bg-muted/20 text-muted"
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PlayerAvatar({
  name,
  avatarUrl,
  isWinner,
}: {
  name: string;
  avatarUrl: string | null;
  isWinner: boolean;
}) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
          isWinner
            ? "bg-green-500/20 text-green-400 ring-2 ring-green-500"
            : "bg-indigo-500/20 text-indigo-400"
        }`}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          initial
        )}
      </div>
      {isWinner && (
        <span className="text-xs font-semibold text-green-400">Winner</span>
      )}
    </div>
  );
}

function ResultIcon({ result }: { result: string }) {
  switch (result) {
    case "hit":
      return <span className="text-green-400">&#10003;</span>;
    case "miss":
      return <span className="text-red-400">&#10007;</span>;
    default:
      return <span className="text-amber-400">&#8987;</span>;
  }
}

interface PickRowProps {
  pick: {
    id: string;
    selection: string;
    result: string;
    actual_value: number | null;
    prop: {
      id: string;
      player_name: string;
      stat_category: string;
      line: number;
      game_id: string;
    } | null;
  };
}

function PickRow({ pick }: PickRowProps) {
  const statCat = (pick.prop?.stat_category ?? "points") as StatCategory;
  return (
    <div className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-background/50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <ResultIcon result={pick.result} />
        <span className="truncate text-sm font-medium">
          {pick.prop?.player_name ?? "Unknown"}
        </span>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
            CATEGORY_COLORS[statCat] ?? ""
          }`}
        >
          {CATEGORY_LABELS[statCat] ?? statCat}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold">{pick.prop?.line ?? "\u2014"}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
            pick.selection === "over"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {pick.selection === "over" ? "Over" : "Under"}
        </span>
        {pick.actual_value !== null && (
          <span className="text-xs text-muted">
            Actual: {pick.actual_value}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Player Side Panel ---------- */

function PlayerSide({
  label,
  name,
  avatarUrl,
  card,
  isWinner,
  showPicks,
}: {
  label: string;
  name: string;
  avatarUrl: string | null;
  card: ChallengeDetail["challenger_card"];
  isWinner: boolean;
  showPicks: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Player identity */}
      <div className="flex flex-col items-center gap-1">
        <PlayerAvatar name={name} avatarUrl={avatarUrl} isWinner={isWinner} />
        <span className="text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted">{label}</span>
      </div>

      {/* Card info */}
      {card ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                card.status === "resolved"
                  ? "bg-purple-500/20 text-purple-400"
                  : card.status === "locked"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-muted/20 text-muted"
              }`}
            >
              {card.status === "resolved"
                ? `${card.score}/${card.total_picks}`
                : card.status === "locked"
                  ? "Locked In"
                  : "Draft"}
            </span>
          </div>

          {/* Picks */}
          {showPicks && card.picks.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {card.picks.map((pick) => (
                <PickRow key={pick.id} pick={pick} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-muted">No card yet</p>
      )}
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function ChallengeMatchup({
  challenge,
  currentUserId,
}: ChallengeMatchupProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChallenger = challenge.challenger_id === currentUserId;
  const challengerName =
    challenge.challenger.display_name || challenge.challenger.username;
  const opponentName =
    challenge.opponent.display_name || challenge.opponent.username;

  // Determine if the current user has submitted their card
  const myCard = isChallenger
    ? challenge.challenger_card
    : challenge.opponent_card;
  const theirCard = isChallenger
    ? challenge.opponent_card
    : challenge.challenger_card;
  const otherPlayerName = isChallenger ? opponentName : challengerName;

  // Determine pick visibility: show picks when status is active or resolved
  const showPicks =
    challenge.status === "active" || challenge.status === "resolved";

  // Winner detection
  const challengerIsWinner =
    challenge.status === "resolved" &&
    challenge.winner_id === challenge.challenger_id;
  const opponentIsWinner =
    challenge.status === "resolved" &&
    challenge.winner_id === challenge.opponent_id;
  const isDraw =
    challenge.status === "resolved" && challenge.winner_id === null;

  const date = new Date(challenge.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleAction(action: "accept" | "decline" | "cancel") {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Failed to ${action} challenge`
        );
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} challenge`
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/challenges"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        &larr; Back to Challenges
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-bold sm:text-2xl">Challenge Matchup</h1>
          <StatusBadge status={challenge.status} />
        </div>
        <span className="text-sm text-muted">{date}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Winner Banner (resolved only) */}
      {challenge.status === "resolved" && (
        <div
          className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${
            isDraw
              ? "border-border bg-muted/10 text-muted"
              : challenge.winner_id === currentUserId
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {isDraw
            ? "It's a draw!"
            : challenge.winner_id === currentUserId
              ? "You won this challenge!"
              : `${otherPlayerName} won this challenge`}
        </div>
      )}

      {/* Matchup Layout */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Challenger Side */}
          <PlayerSide
            label="Challenger"
            name={challengerName}
            avatarUrl={challenge.challenger.avatar_url}
            card={challenge.challenger_card}
            isWinner={challengerIsWinner}
            showPicks={showPicks}
          />

          {/* VS divider - horizontal on mobile, vertical on desktop */}
          <div className="flex items-center justify-center md:flex-col md:justify-start md:pt-8">
            <div className="hidden h-px flex-1 bg-border md:block md:h-auto md:w-px" />
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-400">
              VS
            </div>
            <div className="hidden h-px flex-1 bg-border md:block md:h-auto md:w-px" />
          </div>

          {/* Opponent Side */}
          <PlayerSide
            label="Opponent"
            name={opponentName}
            avatarUrl={challenge.opponent.avatar_url}
            card={challenge.opponent_card}
            isWinner={opponentIsWinner}
            showPicks={showPicks}
          />
        </div>
      </div>

      {/* Status-specific CTAs */}
      {challenge.status === "pending" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          {isChallenger ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted">
                Waiting for <span className="font-semibold text-foreground">{opponentName}</span> to accept
              </p>
              <button
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
                className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                {actionLoading ? "Cancelling..." : "Cancel Challenge"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted">
                <span className="font-semibold text-foreground">{challengerName}</span> challenged you!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction("accept")}
                  disabled={actionLoading}
                  className="min-h-[44px] rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Accept"}
                </button>
                <button
                  onClick={() => handleAction("decline")}
                  disabled={actionLoading}
                  className="min-h-[44px] rounded-lg border border-border px-5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {actionLoading ? "..." : "Decline"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {challenge.status === "accepted" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            {!myCard ? (
              <>
                <p className="text-sm text-muted">
                  Time to make your picks for this challenge!
                </p>
                <Link
                  href={`/props?challenge_id=${challenge.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
                >
                  Make Your Picks
                </Link>
              </>
            ) : !theirCard ? (
              <p className="text-sm text-muted">
                Waiting for <span className="font-semibold text-foreground">{otherPlayerName}</span> to make
                their picks
              </p>
            ) : (
              <p className="text-sm text-muted">
                Both players have submitted cards. The challenge will begin soon.
              </p>
            )}
          </div>
        </div>
      )}

      {challenge.status === "active" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-semibold text-green-400">
              Challenge is live!
            </p>
            <p className="text-xs text-muted">
              Both players have locked in their picks. Results will be revealed
              once games finish.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
