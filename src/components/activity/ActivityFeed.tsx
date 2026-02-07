"use client";

import type { ActivityItem as ActivityItemType } from "@/app/api/activity/route";
import ActivityItem from "./ActivityItem";

interface ActivityFeedProps {
  items: ActivityItemType[];
}

export default function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
        <span className="text-3xl">{"\uD83D\uDCE1"}</span>
        <p className="text-muted">No recent activity</p>
        <p className="text-sm text-muted">
          Activity from your friends will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        // Build a unique key from type + relevant id + timestamp
        let key: string;
        switch (item.type) {
          case "card_resolved":
            key = `card-${item.data.card_id}`;
            break;
          case "challenge_resolved":
            key = `challenge-${item.data.challenge_id}`;
            break;
          case "new_friend":
            key = `friend-${item.data.friendship_id}`;
            break;
          default:
            key = `item-${index}`;
        }

        return <ActivityItem key={key} item={item} />;
      })}
    </div>
  );
}
