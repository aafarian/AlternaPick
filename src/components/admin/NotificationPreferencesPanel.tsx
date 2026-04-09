"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Trophy, Swords, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  NotificationType,
  EmailNotificationType,
  NotificationPreferences,
} from "@/lib/supabase/types";

interface ToggleableType {
  key: NotificationType;
  label: string;
  description: string;
  icon: React.ReactNode;
  emailKey?: EmailNotificationType;
}

// Mirrors the user-facing NotificationPreferencesSection so admins see the
// same shape the user sees in their own settings.
const NOTIFICATION_TYPES: ToggleableType[] = [
  {
    key: "card_resolved",
    label: "Card Results",
    description: "When a pick card is resolved with final scores.",
    icon: <Trophy className="h-4 w-4" />,
    emailKey: "email_card_resolved",
  },
  {
    key: "challenge_received",
    label: "Challenge Received",
    description: "When someone sends them a head-to-head challenge.",
    icon: <Swords className="h-4 w-4" />,
    emailKey: "email_challenge_received",
  },
  {
    key: "challenge_resolved",
    label: "Challenge Results",
    description: "When a challenge is resolved with a winner.",
    icon: <Swords className="h-4 w-4" />,
    emailKey: "email_challenge_resolved",
  },
  {
    key: "friend_request",
    label: "Friend Requests",
    description: "When someone sends them a friend request.",
    icon: <UserPlus className="h-4 w-4" />,
    emailKey: "email_friend_request",
  },
];

const DEFAULT_PREFERENCES: NotificationPreferences = {
  friend_request: true,
  friend_accepted: true,
  challenge_received: true,
  challenge_accepted: true,
  challenge_resolved: true,
  card_resolved: true,
  achievement_unlocked: true,
  reaction_received: true,
  daily_recap: true,
  email_card_resolved: true,
  email_challenge_received: true,
  email_challenge_resolved: true,
  email_friend_request: true,
};

interface NotificationPreferencesPanelProps {
  userId: string;
  username: string;
  initialPreferences: NotificationPreferences | null;
}

export default function NotificationPreferencesPanel({
  userId,
  username,
  initialPreferences,
}: NotificationPreferencesPanelProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES,
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleToggle(
    key: NotificationType | EmailNotificationType,
  ) {
    if (savingKey) return;

    const previous = preferences;
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    setSavingKey(key);

    try {
      const res = await fetch(
        `/api/admin/users/${userId}/notification-preferences`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: updated[key] }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update preference");
      }

      toast.success(`Saved for ${username}`);
    } catch (err) {
      // Roll back optimistic update
      setPreferences(previous);
      toast.error(
        err instanceof Error ? err.message : "Failed to save preference",
      );
    } finally {
      setSavingKey(null);
    }
  }

  function ToggleSwitch({
    checked,
    onClick,
    disabled,
    label,
  }: {
    checked: boolean;
    onClick: () => void;
    disabled: boolean;
    label: string;
  }) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    );
  }

  return (
    <Card className="py-4">
      <CardHeader className="pb-2 pt-0 px-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Notification Preferences
          </CardTitle>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Mirror of the user&apos;s in-app preferences. Use this to disable a
          channel for a user who has opted out verbally — every change is
          logged for audit.
        </p>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0">
        {/* Column headers */}
        <div className="mb-2 flex items-center justify-end gap-4 pr-1">
          <span className="w-11 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">
            In-App
          </span>
          <span className="w-11 text-center text-[10px] font-medium uppercase text-muted-foreground tracking-wider">
            Email
          </span>
        </div>

        <div className="space-y-1">
          {NOTIFICATION_TYPES.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  checked={preferences[item.key] ?? true}
                  onClick={() => handleToggle(item.key)}
                  disabled={savingKey !== null}
                  label={`${item.label} in-app`}
                />
                {item.emailKey ? (
                  <ToggleSwitch
                    checked={preferences[item.emailKey] ?? true}
                    onClick={() => handleToggle(item.emailKey!)}
                    disabled={savingKey !== null}
                    label={`${item.label} email`}
                  />
                ) : (
                  <div className="w-11" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
