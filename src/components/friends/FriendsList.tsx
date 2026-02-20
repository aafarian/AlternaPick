"use client";

import { useState } from "react";
import Link from "next/link";
import type { FriendRequest } from "./FriendRequestCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-3xl">👋</span>
          <p className="text-muted-foreground">No friends yet</p>
          <p className="text-sm text-muted-foreground">
            Search for users above to send friend requests.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {friends.map((friend) => {
        const profile = friend.friend_profile;
        const initials = profile.username
          .slice(0, 2)
          .toUpperCase();
        const isConfirming = confirmId === friend.id;
        const isLoading = loading === friend.id;

        return (
          <Card key={friend.id} className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <Link href={`/users/${profile.username}`} className="flex items-center gap-4 min-w-0 flex-1">
                <Avatar className="h-12 w-12 shrink-0">
                  {profile.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={profile.username} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold hover:text-primary transition-colors">
                    {profile.username}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
                </div>
              </Link>

              <div className="flex shrink-0 gap-2">
                {isConfirming ? (
                  <>
                    <Button
                      onClick={() => handleUnfriend(friend.id)}
                      disabled={isLoading}
                      variant="destructive"
                      size="sm"
                    >
                      {isLoading ? "..." : "Confirm"}
                    </Button>
                    <Button
                      onClick={() => setConfirmId(null)}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setConfirmId(friend.id)}
                    variant="outline"
                    size="sm"
                  >
                    Unfriend
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
