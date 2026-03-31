"use client";

import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { FriendRequest } from "./FriendRequestCard";
import UserAvatar from "@/components/icons/UserAvatar";
import { parseIconConfig } from "@/lib/icons/parse";
import UserProfilePopover from "@/components/user/UserProfilePopover";

interface FriendsStripProps {
  friends: FriendRequest[];
  onUnfriend: (id: string) => Promise<void>;
}

export default function FriendsStrip({ friends, onUnfriend }: FriendsStripProps) {
  const prefersReduced = useReducedMotion();

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
              <UserProfilePopover
                userId={profile.id}
                username={profile.username}
                friendshipId={friend.id}
                onUnfriend={onUnfriend}
              >
                <div className="group flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <div className="rounded-full ring-2 ring-transparent transition-all duration-200 group-hover:ring-primary/40 group-hover:shadow-[0_0_12px_rgba(0,210,106,0.2)] group-focus-visible:ring-primary">
                    <UserAvatar
                      avatarUrl={profile.avatar_url}
                      iconConfig={parseIconConfig(profile.icon_config)}
                      userId={profile.id}
                      username={profile.username}
                      size={48}
                    />
                  </div>
                  <span className="w-full truncate text-center text-[11px] text-muted-foreground group-hover:text-foreground">
                    {firstName}
                  </span>
                </div>
              </UserProfilePopover>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
