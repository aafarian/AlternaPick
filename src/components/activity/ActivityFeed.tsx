"use client";

import type { ActivityItem as ActivityItemType } from "@/app/api/activity/route";
import ActivityItem from "./ActivityItem";
import { AnimatedList } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";

interface ActivityFeedProps {
  items: ActivityItemType[];
}

export default function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <AnimatedEmptyState
        icon="📡"
        title="No recent activity"
        description="Activity from your friends will show up here."
      />
    );
  }

  return (
    <AnimatedList className="flex flex-col gap-3" animationType="slideUp">
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
    </AnimatedList>
  );
}
