"use client";

import { useState } from "react";
import Image from "next/image";
import type { FriendRequest } from "./FriendRequestCard";

interface FriendsListProps {
  friends: FriendRequest[];
  onUnfriend: (id: string) => Promise<void>;
}

export default function FriendsList({ friends, onUnfriend }: FriendsListProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUnfriend = async (id: string) => {
    setLoading(id);
    try {
      await onUnfriend(id);
    } finally {
      setLoading(null);
      setConfirmId(null);
    }
  };

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
        <span className="text-3xl">👋</span>
        <p className="text-muted">No friends yet</p>
        <p className="text-sm text-muted">
          Search for users above to send friend requests.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {friends.map((friend) => {
        const profile = friend.friend_profile;
        const initials = (profile.display_name ?? profile.username)
          .slice(0, 2)
          .toUpperCase();
        const isConfirming = confirmId === friend.id;
        const isLoading = loading === friend.id;

        return (
          <div
            key={friend.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
          >
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-400">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {profile.display_name ?? profile.username}
              </p>
              <p className="truncate text-sm text-muted">@{profile.username}</p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-2">
              {isConfirming ? (
                <>
                  <button
                    onClick={() => handleUnfriend(friend.id)}
                    disabled={isLoading}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    disabled={isLoading}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmId(friend.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover"
                >
                  Unfriend
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
