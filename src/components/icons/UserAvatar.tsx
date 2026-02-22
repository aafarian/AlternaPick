"use client";

import React, { memo, useMemo } from "react";
import Image from "next/image";

import type { IconConfig } from "@/lib/icons/types";
import { generateRandomIcon } from "@/lib/icons/generator";
import UserIcon from "@/components/icons/UserIcon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  iconConfig: IconConfig | null | undefined;
  userId: string;
  username?: string;
  size: number;
  className?: string;
}

/**
 * Unified avatar component with a three-tier fallback chain:
 *
 * 1. `avatarUrl` (uploaded image) -- renders via Radix Avatar + Next/Image
 * 2. `iconConfig` (user-chosen icon) -- renders the UserIcon SVG directly
 * 3. Random icon seeded by `userId` -- deterministic fallback so every user
 *    always gets the same generated icon
 */
const UserAvatar = memo(function UserAvatar({
  avatarUrl,
  iconConfig,
  userId,
  username,
  size,
  className,
}: UserAvatarProps) {
  // Memoize the random icon so it isn't regenerated on every render.
  // Only used when both avatarUrl and iconConfig are absent.
  const fallbackConfig = useMemo(
    () => generateRandomIcon(userId),
    [userId],
  );

  // Path 1: uploaded image
  if (avatarUrl) {
    return (
      <Avatar
        className={className}
        style={{ width: size, height: size }}
      >
        <Image
          src={avatarUrl}
          alt={username ?? "User avatar"}
          width={size}
          height={size}
          className="aspect-square size-full object-cover"
        />
        <AvatarFallback
          className="bg-primary/10 text-primary font-bold"
          style={{ fontSize: size * 0.4 }}
        >
          {(username ?? "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    );
  }

  // Path 2: saved icon config
  if (iconConfig) {
    return <UserIcon config={iconConfig} size={size} className={className} />;
  }

  // Path 3: deterministic random icon seeded by userId
  return <UserIcon config={fallbackConfig} size={size} className={className} />;
});

UserAvatar.displayName = "UserAvatar";

export default UserAvatar;
export type { UserAvatarProps };
