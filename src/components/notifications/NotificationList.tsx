"use client";

import type { Notification } from "@/lib/supabase/types";
import NotificationItem from "./NotificationItem";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-3xl">{"\uD83D\uDD14"}</span>
          <p className="text-muted-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground">
            You&apos;ll be notified about friend requests, challenges, and results
            here.
          </p>
        </CardContent>
      </Card>
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
