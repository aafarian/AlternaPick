"use client";

import { useState } from "react";
import Image from "next/image";

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  friend_profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  };
}

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}

export default function FriendRequestCard({
  request,
  onAccept,
  onDecline,
}: FriendRequestCardProps) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  const handleAccept = async () => {
    setLoading("accept");
    try {
      await onAccept(request.id);
    } finally {
      setLoading(null);
    }
  };

  const handleDecline = async () => {
    setLoading("decline");
    try {
      await onDecline(request.id);
    } finally {
      setLoading(null);
    }
  };

  const profile = request.friend_profile;
  const initials = (profile.display_name ?? profile.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
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
        <button
          onClick={handleAccept}
          disabled={loading !== null}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading === "accept" ? "..." : "Accept"}
        </button>
        <button
          onClick={handleDecline}
          disabled={loading !== null}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          {loading === "decline" ? "..." : "Decline"}
        </button>
      </div>
    </div>
  );
}
