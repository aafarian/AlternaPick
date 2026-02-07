"use client";

import type { ActivityItem as ActivityItemType } from "@/app/api/activity/route";

interface ActivityItemProps {
  item: ActivityItemType;
}

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

function getIcon(type: ActivityItemType["type"]): string {
  switch (type) {
    case "card_resolved":
      return "\uD83C\uDFAF";
    case "challenge_resolved":
      return "\u2694\uFE0F";
    case "new_friend":
      return "\uD83E\uDD1D";
    default:
      return "\uD83D\uDD14";
  }
}

function getAccentClass(type: ActivityItemType["type"]): string {
  switch (type) {
    case "card_resolved":
      return "bg-emerald-500/15 text-emerald-400";
    case "challenge_resolved":
      return "bg-indigo-500/15 text-indigo-400";
    case "new_friend":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-muted/15 text-muted";
  }
}

function renderMessage(item: ActivityItemType): string {
  const username =
    item.user.display_name ?? item.user.username;

  switch (item.type) {
    case "card_resolved": {
      const { score, total_picks } = item.data;
      return `${username} went ${score}/${total_picks} on their picks`;
    }
    case "challenge_resolved": {
      const { challenger, opponent, winner_id, challenger_score, opponent_score } =
        item.data;
      const challengerName =
        challenger.display_name ?? challenger.username;
      const opponentName =
        opponent.display_name ?? opponent.username;

      if (!winner_id) {
        return `${challengerName} and ${opponentName} tied ${challenger_score}-${opponent_score}`;
      }

      const winnerName =
        winner_id === challenger.id ? challengerName : opponentName;
      const loserName =
        winner_id === challenger.id ? opponentName : challengerName;
      const winnerScore =
        winner_id === challenger.id ? challenger_score : opponent_score;
      const loserScore =
        winner_id === challenger.id ? opponent_score : challenger_score;

      return `${winnerName} beat ${loserName} ${winnerScore}-${loserScore} in a challenge`;
    }
    case "new_friend": {
      return `You and ${username} are now friends`;
    }
    default:
      return "Unknown activity";
  }
}

export default function ActivityItem({ item }: ActivityItemProps) {
  const icon = getIcon(item.type);
  const accentClass = getAccentClass(item.type);
  const message = renderMessage(item);
  const timeAgo = formatTimeAgo(item.timestamp);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      {/* Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${accentClass}`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed">{message}</p>
        <p className="mt-1 text-xs text-muted">{timeAgo}</p>
      </div>
    </div>
  );
}
