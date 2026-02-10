"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    <Card className="border-border bg-card">
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-12 w-12">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.username} />
          )}
          <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {profile.display_name ?? profile.username}
          </p>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            onClick={handleAccept}
            disabled={loading !== null}
            size="sm"
          >
            {loading === "accept" ? "..." : "Accept"}
          </Button>
          <Button
            onClick={handleDecline}
            disabled={loading !== null}
            variant="outline"
            size="sm"
          >
            {loading === "decline" ? "..." : "Decline"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
