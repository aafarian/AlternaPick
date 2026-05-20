"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/icons/UserAvatar";
import { parseIconConfig } from "@/lib/icons/parse";
import { logWarn } from "@/lib/logger";

interface SuggestedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
  label: string | null;
}

interface SuggestedFriendsProps {
  onSendRequest: (username: string) => Promise<void>;
}

export default function SuggestedFriends({ onSendRequest }: SuggestedFriendsProps) {
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/friends/suggested")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.suggestions) setSuggestions(data.suggestions);
      })
      .catch((err) => logWarn("suggested-friends", "Failed to fetch", err))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = useCallback(async (username: string) => {
    setSendingTo(username);
    try {
      await onSendRequest(username);
      setSentTo((prev) => new Set([...prev, username]));
    } finally {
      setSendingTo(null);
    }
  }, [onSendRequest]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {suggestions.map((user) => {
        const isSent = sentTo.has(user.username);
        return (
          <div
            key={user.id}
            className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
          >
            <UserAvatar
              avatarUrl={user.avatar_url}
              iconConfig={parseIconConfig(user.icon_config)}
              userId={user.id}
              username={user.username}
              size={36}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold">{user.username}</p>
                {user.label && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                    {user.label}
                  </Badge>
                )}
              </div>
            </div>
            {isSent ? (
              <Badge variant="secondary" className="text-[10px]">Sent</Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAdd(user.username)}
                disabled={sendingTo === user.username}
                className="h-7 gap-1 text-xs"
              >
                {sendingTo === user.username ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-3 w-3" />
                    Add
                  </>
                )}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
