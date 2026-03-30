"use client";

import { useState, useEffect } from "react";
import { Users, Mail, UserPlus, Loader2, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InvitePanelProps {
  /** IDs of users already in the challenge (to exclude from friend list) */
  excludeUserIds: string[];
  /** Whether an action is in progress */
  actionLoading: boolean;
  /** Called when inviting one or more friends */
  onInviteUsers: (friends: Array<{ id: string; username: string }>) => void;
  /** Called when inviting by email */
  onInviteEmail: (email: string) => void;
  /** Called when the panel is closed */
  onClose: () => void;
}

export default function InvitePanel({
  excludeUserIds,
  actionLoading,
  onInviteUsers,
  onInviteEmail,
  onClose,
}: InvitePanelProps) {
  const [mode, setMode] = useState<"friends" | "email">("friends");
  const [friends, setFriends] = useState<Array<{ id: string; username: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");

  // Fetch friends on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/friends?status=accepted");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list = (data.friends ?? []).map(
          (f: { friend_profile: { id: string; username: string } }) => f.friend_profile
        );
        if (!cancelled) setFriends(list);
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredFriends = friends.filter((f) => {
    if (excludeUserIds.includes(f.id)) return false;
    if (!search.trim()) return true;
    return f.username.toLowerCase().includes(search.toLowerCase().trim());
  });

  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Invite to Challenge</span>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
          <button
            onClick={() => setMode("friends")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === "friends"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Friends
          </button>
          <button
            onClick={() => setMode("email")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === "email"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </button>
        </div>

        {mode === "friends" ? (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No friends found. Add friends first!
              </p>
            ) : (
              <>
                {friends.length >= 5 && (
                  <input
                    type="text"
                    placeholder="Search friends..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 rounded-md border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  {filteredFriends.map((friend) => {
                    const isSelected = selected.has(friend.id);
                    return (
                      <button
                        key={friend.id}
                        onClick={() => toggleFriend(friend.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all",
                          isSelected
                            ? "border-orange-500 bg-orange-500/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-orange-500/50 hover:bg-orange-500/5",
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-3 w-3 text-orange-500" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                        {friend.username}
                      </button>
                    );
                  })}
                </div>
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    className="mx-auto"
                    disabled={actionLoading}
                    onClick={() => {
                      const selectedFriends = friends.filter((f) => selected.has(f.id));
                      onInviteUsers(selectedFriends);
                    }}
                  >
                    {actionLoading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Invite {selected.size} {selected.size === 1 ? "friend" : "friends"}
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.includes("@")) {
                    onInviteEmail(email.trim());
                    setEmail("");
                  }
                }}
                className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={actionLoading || !email.includes("@")}
                onClick={() => {
                  onInviteEmail(email.trim());
                  setEmail("");
                }}
              >
                {actionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              They&apos;ll get an email to join the challenge
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
