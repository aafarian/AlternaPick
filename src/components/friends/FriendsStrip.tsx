"use client";

import { useState } from "react";
import Link from "next/link";
import type { FriendRequest } from "./FriendRequestCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Swords, UserMinus } from "lucide-react";

interface FriendsStripProps {
  friends: FriendRequest[];
  onUnfriend: (id: string) => Promise<void>;
}

export default function FriendsStrip({ friends, onUnfriend }: FriendsStripProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUnfriend = async (id: string) => {
    setLoading(id);
    try {
      await onUnfriend(id);
    } finally {
      setLoading(null);
    }
  };

  if (friends.length === 0) {
    return (
      <p className="py-2 text-center text-sm text-muted-foreground">
        Search above to add friends and see their activity.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto py-1 scrollbar-none">
      {friends.map((friend) => {
        const profile = friend.friend_profile;
        const initials = (profile.display_name ?? profile.username)
          .slice(0, 2)
          .toUpperCase();
        const displayName = profile.display_name ?? profile.username;
        const firstName = displayName.split(" ")[0];

        return (
          <DropdownMenu key={friend.id}>
            <DropdownMenuTrigger asChild>
              <button className="group flex w-16 shrink-0 flex-col items-center gap-1.5 outline-none">
                <Avatar className="h-12 w-12 ring-2 ring-transparent transition-all group-hover:ring-primary/40 group-focus-visible:ring-primary">
                  {profile.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={profile.username} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground group-hover:text-foreground">
                  {firstName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-44">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`/challenges?opponent=${profile.username}`}
                  className="gap-2"
                >
                  <Swords className="h-4 w-4" />
                  Challenge
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleUnfriend(friend.id)}
                disabled={loading === friend.id}
                className="gap-2 text-muted-foreground focus:text-destructive"
              >
                <UserMinus className="h-4 w-4" />
                {loading === friend.id ? "Removing..." : "Unfriend"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
