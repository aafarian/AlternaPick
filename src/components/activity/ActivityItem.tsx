"use client";

import Link from "next/link";
import type { ActivityItem as ActivityItemType } from "@/app/api/activity/route";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/format";
import { getNotificationIcon, getNotificationAccent } from "@/lib/constants";
import { ScaleIn } from "@/components/motion";

interface ActivityItemProps {
  item: ActivityItemType;
}

function getCardFlavorText(score: number, total: number): string {
  const ratio = total > 0 ? score / total : 0;
  if (score === total) return "went perfect";
  if (ratio >= 0.8) return "was on fire";
  if (ratio >= 0.6) return "had a solid day";
  if (ratio >= 0.4) return "had a mixed day";
  if (score > 0) return "had a rough one";
  return "went ice cold";
}

function renderMessage(item: ActivityItemType): string {
  const username =
    item.user.display_name ?? item.user.username;

  switch (item.type) {
    case "card_resolved": {
      const { score, total_picks } = item.data;
      const flavor = getCardFlavorText(score, total_picks);
      return `${username} ${flavor} \u2014 ${score}/${total_picks} hits`;
    }
    case "challenge_resolved": {
      const { challenger, opponent, winner_id, challenger_score, opponent_score } =
        item.data;
      const challengerName =
        challenger.display_name ?? challenger.username;
      const opponentName =
        opponent.display_name ?? opponent.username;

      if (!winner_id) {
        return `${challengerName} and ${opponentName} deadlocked ${challenger_score}-${opponent_score}`;
      }

      const winnerName =
        winner_id === challenger.id ? challengerName : opponentName;
      const loserName =
        winner_id === challenger.id ? opponentName : challengerName;
      const winnerScore =
        winner_id === challenger.id ? challenger_score : opponent_score;
      const loserScore =
        winner_id === challenger.id ? opponent_score : challenger_score;
      const margin = winnerScore - loserScore;

      if (margin >= 3) {
        return `${winnerName} dominated ${loserName} ${winnerScore}-${loserScore}`;
      }
      if (margin === 1) {
        return `${winnerName} edged out ${loserName} ${winnerScore}-${loserScore}`;
      }
      return `${winnerName} beat ${loserName} ${winnerScore}-${loserScore}`;
    }
    case "new_friend": {
      return `You and ${username} are now friends`;
    }
    default:
      return "Unknown activity";
  }
}

function getItemHref(item: ActivityItemType): string | null {
  switch (item.type) {
    case "challenge_resolved":
      return `/challenges/${item.data.challenge_id}`;
    case "new_friend":
      return `/users/${item.user.username}`;
    default:
      return null;
  }
}

export default function ActivityItem({ item }: ActivityItemProps) {
  const icon = getNotificationIcon(item.type);
  const accentClass = getNotificationAccent(item.type);
  const message = renderMessage(item);
  const timeAgo = formatTimeAgo(item.timestamp);
  const href = getItemHref(item);

  const content = (
    <CardContent className="flex items-start gap-3 p-4">
      {/* Icon — pops in with ScaleIn */}
      <ScaleIn delay={0.05} duration={0.35} initialScale={0.5}>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${accentClass}`}
        >
          {icon}
        </div>
      </ScaleIn>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/50 hover:shadow-md">
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {content}
    </Card>
  );
}
