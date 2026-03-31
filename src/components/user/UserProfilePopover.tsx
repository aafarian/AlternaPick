"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Swords, UserMinus, User } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

interface UserProfilePopoverProps {
  /** Target user's ID */
  userId: string;
  /** Target user's username */
  username?: string;
  /** Friendship ID — if provided, enables the Unfriend action */
  friendshipId?: string;
  /** Called when the user confirms unfriend */
  onUnfriend?: (friendshipId: string) => Promise<void>;
  /** Dropdown alignment (default: "center") */
  align?: "start" | "center" | "end";
  /** The trigger element (avatar, name, or both) */
  children: React.ReactNode;
  /** Extra classes for the trigger button (e.g. layout/sizing) */
  className?: string;
  /** Disable the popover entirely (renders children as-is) */
  disabled?: boolean;
}

export default function UserProfilePopover({
  userId,
  username,
  friendshipId,
  onUnfriend,
  align = "center",
  children,
  className,
  disabled,
}: UserProfilePopoverProps) {
  const { user } = useAuth();
  const [unfriendLoading, setUnfriendLoading] = useState(false);
  const isCurrentUser = user?.id === userId;

  // When disabled, no userId, or no username, render children without wrapper
  if (disabled || !userId || !username) {
    return <>{children}</>;
  }

  const profileHref = isCurrentUser ? "/profile" : `/users/${username}`;

  const handleUnfriend = async () => {
    if (!friendshipId || !onUnfriend) return;
    setUnfriendLoading(true);
    try {
      await onUnfriend(friendshipId);
    } finally {
      setUnfriendLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44 duration-200">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold">{username}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{username}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref} className="gap-2">
            <User className="h-4 w-4" />
            View Profile
          </Link>
        </DropdownMenuItem>
        {!isCurrentUser && (
          <DropdownMenuItem asChild>
            <Link
              href={`/challenges?opponent=${userId}`}
              className="gap-2"
            >
              <Swords className="h-4 w-4" />
              Challenge
            </Link>
          </DropdownMenuItem>
        )}
        {friendshipId && onUnfriend && !isCurrentUser && (
          <DropdownMenuItem
            onClick={handleUnfriend}
            disabled={unfriendLoading}
            className="gap-2 text-muted-foreground focus:text-destructive"
          >
            <UserMinus className="h-4 w-4" />
            {unfriendLoading ? "Removing..." : "Unfriend"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
