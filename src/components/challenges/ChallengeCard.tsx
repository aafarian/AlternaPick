"use client";

import Link from "next/link";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";

interface ChallengeCardProps {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  actionLoading?: string | null;
}

function getOpponentInfo(
  challenge: ChallengeWithProfiles,
  currentUserId: string
) {
  const isChallenger = challenge.challenger_id === currentUserId;
  const opponent = isChallenger ? challenge.opponent : challenge.challenger;
  return {
    isChallenger,
    opponent,
    displayName:
      opponent.display_name || opponent.username,
    avatarInitial: (opponent.display_name || opponent.username)
      .charAt(0)
      .toUpperCase(),
  };
}

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

function WinnerBadge({
  challenge,
  currentUserId,
}: {
  challenge: ChallengeWithProfiles;
  currentUserId: string;
}) {
  if (challenge.status !== "resolved") return null;

  if (!challenge.winner_id) {
    return (
      <span className="rounded-full bg-muted/20 px-2.5 py-0.5 text-xs font-semibold text-muted">
        Draw
      </span>
    );
  }

  const won = challenge.winner_id === currentUserId;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
      }`}
    >
      {won ? "You Won" : "You Lost"}
    </span>
  );
}

export default function ChallengeCard({
  challenge,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
  actionLoading,
}: ChallengeCardProps) {
  const { isChallenger, displayName, avatarInitial } = getOpponentInfo(
    challenge,
    currentUserId
  );
  const isLoading = actionLoading === challenge.id;

  const date = new Date(challenge.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/challenges/${challenge.id}`}
      className="block rounded-2xl border border-border bg-surface transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-400">
            {avatarInitial}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{displayName}</span>
              <StatusBadge status={challenge.status} />
              <WinnerBadge
                challenge={challenge}
                currentUserId={currentUserId}
              />
            </div>
            <p className="text-xs text-muted">
              {isChallenger ? "You challenged" : "Challenged you"} &middot;{" "}
              {date}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.preventDefault()}
        >
          {/* Pending incoming: Accept / Decline */}
          {challenge.status === "pending" && !isChallenger && (
            <>
              <button
                onClick={() => onAccept?.(challenge.id)}
                disabled={isLoading}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
              >
                {isLoading ? "..." : "Accept"}
              </button>
              <button
                onClick={() => onDecline?.(challenge.id)}
                disabled={isLoading}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )}

          {/* Pending outgoing: Cancel */}
          {challenge.status === "pending" && isChallenger && (
            <button
              onClick={() => onCancel?.(challenge.id)}
              disabled={isLoading}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {isLoading ? "..." : "Cancel"}
            </button>
          )}

          {/* Active: Make Your Picks or Waiting */}
          {(challenge.status === "accepted" ||
            challenge.status === "active") && (
            <Link
              href={`/props?challenge_id=${challenge.id}`}
              className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600"
              onClick={(e) => e.stopPropagation()}
            >
              Make Your Picks
            </Link>
          )}

          {/* Resolved: View link only (card click handles it) */}
          {challenge.status === "resolved" && (
            <span className="text-xs text-muted">View Details</span>
          )}
        </div>
      </div>
    </Link>
  );
}
