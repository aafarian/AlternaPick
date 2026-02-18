"use client";

import type { Notification } from "@/lib/supabase/types";
import NotificationItem from "./NotificationItem";
import { AnimatedList } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}

export default function NotificationList({
  notifications,
  onMarkRead,
  onNavigate,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <AnimatedEmptyState
        icon={"\uD83D\uDD14"}
        title="No notifications yet"
        description="You'll be notified about friend requests, challenges, and results here."
      />
    );
  }

  return (
    <AnimatedList className="flex flex-col gap-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          onNavigate={onNavigate}
        />
      ))}
    </AnimatedList>
  );
}
