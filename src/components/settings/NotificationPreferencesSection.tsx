"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Bell, Trophy, Users, Swords, UserPlus, Award } from "lucide-react";
import type { NotificationType, EmailNotificationType, NotificationPreferences } from "@/lib/supabase/types";

const NOTIFICATION_TYPES: {
  key: NotificationType;
  label: string;
  description: string;
  icon: React.ReactNode;
  emailKey?: EmailNotificationType;
}[] = [
  {
    key: "card_resolved",
    label: "Card Results",
    description: "Get notified when your pick cards are resolved with final scores.",
    icon: <Trophy className="h-4 w-4" />,
    emailKey: "email_card_resolved",
  },
  {
    key: "challenge_received",
    label: "Challenge Received",
    description: "Get notified when someone sends you a head-to-head challenge.",
    icon: <Swords className="h-4 w-4" />,
    emailKey: "email_challenge_received",
  },
  {
    key: "challenge_accepted",
    label: "Challenge Accepted",
    description: "Get notified when someone accepts your challenge.",
    icon: <Swords className="h-4 w-4" />,
  },
  {
    key: "challenge_resolved",
    label: "Challenge Results",
    description: "Get notified when a challenge is resolved with a winner.",
    icon: <Swords className="h-4 w-4" />,
    emailKey: "email_challenge_resolved",
  },
  {
    key: "friend_request",
    label: "Friend Requests",
    description: "Get notified when someone sends you a friend request.",
    icon: <UserPlus className="h-4 w-4" />,
    emailKey: "email_friend_request",
  },
  {
    key: "friend_accepted",
    label: "Friend Accepted",
    description: "Get notified when someone accepts your friend request.",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "achievement_unlocked",
    label: "Achievements",
    description: "Get notified when you unlock a new badge.",
    icon: <Award className="h-4 w-4" />,
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

interface NotificationPreferencesSectionProps {
  initialPreferences: NotificationPreferences | null;
}

export default function NotificationPreferencesSection({
  initialPreferences,
}: NotificationPreferencesSectionProps) {
  const { supabase, user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleToggle = useCallback(
    async (key: NotificationType | EmailNotificationType) => {
      if (!user || saving) return;

      const updated = { ...preferences, [key]: !preferences[key] };
      setPreferences(updated);
      setSaving(true);
      setMessage(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("profiles") as any)
        .update({ notification_preferences: updated })
        .eq("id", user.id);

      setSaving(false);

      if (error) {
        // Revert on failure
        setPreferences(preferences);
        setMessage({ type: "error", text: "Failed to save preference." });
      } else {
        setMessage({ type: "success", text: "Preference saved!" });
        // Auto-clear success message after 2s
        setTimeout(() => setMessage(null), 2000);
      }
    },
    [user, supabase, preferences, saving]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Notification Preferences</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Control which in-app and email notifications you receive. Disabling a
        type will stop new notifications of that kind from being created.
      </p>

      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={
            message.type === "success"
              ? "mb-4 border-neon-green/30 bg-neon-green/10 text-neon-green"
              : "mb-4"
          }
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Column headers */}
      <div className="mb-1 flex items-center justify-end gap-4 px-3 pr-4">
        <span className="text-xs font-medium text-muted-foreground">In-App</span>
        <span className="text-xs font-medium text-muted-foreground w-11 text-center">Email</span>
      </div>

      <div className="space-y-1">
        {NOTIFICATION_TYPES.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
              {/* In-App toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={preferences[item.key]}
                aria-label={`${item.label} in-app notifications`}
                disabled={saving}
                onClick={() => handleToggle(item.key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                  preferences[item.key]
                    ? "bg-primary"
                    : "bg-input"
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    preferences[item.key]
                      ? "translate-x-5"
                      : "translate-x-0"
                  }`}
                />
              </button>
              {/* Email toggle (only for types with email support) */}
              {item.emailKey ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences[item.emailKey]}
                  aria-label={`${item.label} email notifications`}
                  disabled={saving}
                  onClick={() => handleToggle(item.emailKey!)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                    preferences[item.emailKey]
                      ? "bg-primary"
                      : "bg-input"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                      preferences[item.emailKey]
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              ) : (
                <div className="w-11" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
