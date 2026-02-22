"use client";

import Link from "next/link";
import { SlideUp, ScaleIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedButton } from "@/components/ui/animated-button";
import UserAvatar from "@/components/icons/UserAvatar";
import type { IconConfig } from "@/lib/icons/types";
import { Swords, UserPlus } from "lucide-react";
import { motion, useReducedMotion } from "@/lib/motion";

interface StatItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface AnimatedUserProfileProps {
  profile: {
    id: string;
    username: string;
    avatar_url: string | null;
    icon_config: IconConfig | null;
  };
  memberSince: string;
  initial: string;
  stats: StatItem[] | null;
  currentUser: boolean;
  isFriend: boolean;
  hasPendingFriendship: boolean;
}

const buttonHover = { scale: 1.02 };
const buttonTap = { scale: 0.97 };
const buttonSpring = { type: "spring" as const, stiffness: 400, damping: 25 };

export function AnimatedUserProfile({
  profile,
  memberSince,
  initial,
  stats,
  currentUser,
  isFriend,
  hasPendingFriendship,
}: AnimatedUserProfileProps) {
  const prefersReduced = useReducedMotion();

  return (
    <SlideUp>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <ScaleIn delay={0.1}>
              <UserAvatar
                avatarUrl={profile.avatar_url}
                iconConfig={profile.icon_config}
                userId={profile.id}
                username={profile.username}
                size={64}
              />
            </ScaleIn>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">
                {profile.username}
              </h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <p className="text-xs text-muted-foreground">Member since {memberSince}</p>
            </div>

            {/* Action buttons */}
            {currentUser && (
              <div className="flex shrink-0 gap-2">
                {isFriend ? (
                  <motion.div
                    whileHover={prefersReduced ? undefined : buttonHover}
                    whileTap={prefersReduced ? undefined : buttonTap}
                    transition={buttonSpring}
                  >
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/challenges?opponent=${profile.id}`} className="gap-1.5">
                        <Swords className="h-4 w-4" />
                        Challenge
                      </Link>
                    </Button>
                  </motion.div>
                ) : !hasPendingFriendship ? (
                  <motion.div
                    whileHover={prefersReduced ? undefined : buttonHover}
                    whileTap={prefersReduced ? undefined : buttonTap}
                    transition={buttonSpring}
                  >
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/friends?add=${profile.username}`} className="gap-1.5">
                        <UserPlus className="h-4 w-4" />
                        Add Friend
                      </Link>
                    </Button>
                  </motion.div>
                ) : (
                  <AnimatedButton variant="outline" size="sm" disabled>
                    Pending
                  </AnimatedButton>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <StaggerChildren
              staggerDelay={0.07}
              className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5"
            >
              {stats.map((stat) => (
                <StaggerItem key={stat.label}>
                  <div className="rounded-xl border border-border bg-background/50 p-3 text-center transition-all duration-200 hover:-translate-y-px hover:shadow-md">
                    <div
                      className={`text-lg font-bold tabular-nums ${stat.highlight ? "text-neon-green" : ""}`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerChildren>
          )}
        </CardContent>
      </Card>
    </SlideUp>
  );
}
