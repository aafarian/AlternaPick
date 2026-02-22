"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { FriendRequest } from "./FriendRequestCard";
import UserAvatar from "@/components/icons/UserAvatar";
import type { IconConfig } from "@/lib/icons/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Swords, UserMinus, User } from "lucide-react";

interface FriendsStripProps {
  friends: FriendRequest[];
  onUnfriend: (id: string) => Promise<void>;
}

export default function FriendsStrip({ friends, onUnfriend }: FriendsStripProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

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
      <AnimatePresence mode="popLayout">
        {friends.map((friend, index) => {
          const profile = friend.friend_profile;
          const firstName = profile.username;

          return (
            <motion.div
              key={friend.id}
              initial={prefersReduced ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : {
                      duration: 0.35,
                      ease: "easeOut",
                      delay: index * 0.05,
                    }
              }
              layout={!prefersReduced}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex w-16 shrink-0 flex-col items-center gap-1.5 outline-none">
                    <div className="rounded-full ring-2 ring-transparent transition-all duration-200 group-hover:ring-primary/40 group-hover:shadow-[0_0_12px_rgba(0,210,106,0.2)] group-focus-visible:ring-primary">
                      <UserAvatar
                        avatarUrl={profile.avatar_url}
                        iconConfig={profile.icon_config as IconConfig | null}
                        userId={profile.id}
                        username={profile.username}
                        size={48}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[11px] text-muted-foreground group-hover:text-foreground">
                      {firstName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-44 duration-200">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-semibold">{profile.username}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{profile.username}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/users/${profile.username}`}
                      className="gap-2"
                    >
                      <User className="h-4 w-4" />
                      View Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/challenges?opponent=${profile.id}`}
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
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
