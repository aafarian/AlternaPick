"use client";

import type { Notification } from "@/lib/supabase/types";
import NotificationItem from "./NotificationItem";

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
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
        <span className="text-3xl">{"\uD83D\uDD14"}</span>
        <p className="text-muted">No notifications yet</p>
        <p className="text-sm text-muted">
          You&apos;ll be notified about friend requests, challenges, and results
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
