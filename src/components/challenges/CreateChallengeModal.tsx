"use client";

import { useState, useEffect, useCallback } from "react";

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

  if (!open) return null;

  const filteredFriends = friends.filter((f) => {
    const name = (
      f.friend_profile.display_name || f.friend_profile.username
    ).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Challenge a Friend</h2>
          <button
            onClick={onClose}
            className="text-muted transition-colors hover:text-foreground"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none focus:border-indigo-500"
        />

        {/* Friends list */}
        <div className="mb-4 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-background/50"
                />
              ))}
            </div>
          ) : filteredFriends.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {friends.length === 0
                ? "No friends yet. Add friends first!"
                : "No friends match your search."}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredFriends.map((friend) => {
                const profile = friend.friend_profile;
                const name = profile.display_name || profile.username;
                const isSelected = selectedFriendId === profile.id;
                return (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriendId(profile.id)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-500/20 border border-indigo-500"
                        : "hover:bg-background/50 border border-transparent"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{name}</div>
                      {profile.display_name && (
                        <div className="text-xs text-muted">
                          @{profile.username}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedFriendId || creating}
            className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            {creating ? "Sending..." : "Send Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}
