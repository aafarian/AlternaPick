"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Friend {
  id: string;
  friend_profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CreateChallengeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateChallengeModal({
  open,
  onClose,
  onCreated,
}: CreateChallengeModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/friends?status=accepted");
      if (!res.ok) throw new Error("Failed to load friends");
      const data = await res.json();
      setFriends(data.friends ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFriends();
      setSelectedFriendId(null);
      setSearch("");
      setError(null);
    }
  }, [open, fetchFriends]);

  const handleCreate = async () => {
    if (!selectedFriendId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponent_id: selectedFriendId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create challenge");
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create challenge"
      );
    } finally {
      setCreating(false);
    }
  };

  const filteredFriends = friends.filter((f) => {
    const name = (
      f.friend_profile.display_name || f.friend_profile.username
    ).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Challenge a Friend</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Input
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ScrollArea className="h-64">
          {loading ? (
            <div className="flex flex-col gap-2 p-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : filteredFriends.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {friends.length === 0
                ? "No friends yet. Add friends first!"
                : "No friends match your search."}
            </p>
          ) : (
            <div className="flex flex-col gap-1 p-1">
              {filteredFriends.map((friend) => {
                const profile = friend.friend_profile;
                const name = profile.display_name || profile.username;
                const isSelected = selectedFriendId === profile.id;
                return (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriendId(profile.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-secondary"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-bold">{name}</div>
                      {profile.display_name && (
                        <div className="text-xs text-muted-foreground">
                          @{profile.username}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedFriendId || creating}
            className="flex-1"
          >
            {creating ? "Sending..." : "Send Challenge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
