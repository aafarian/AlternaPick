"use client";

import type { ActivityItem as ActivityItemType } from "@/app/api/activity/route";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeAgo } from "@/lib/format";
import { getNotificationIcon, getNotificationAccent } from "@/lib/constants";

interface ActivityItemProps {
  item: ActivityItemType;
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
  const icon = getNotificationIcon(item.type);
  const accentClass = getNotificationAccent(item.type);
  const message = renderMessage(item);
  const timeAgo = formatTimeAgo(item.timestamp);

  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${accentClass}`}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed">{message}</p>
          <p className="mt-1 text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </CardContent>
    </Card>
  );
}
