import UserAvatar from "@/components/icons/UserAvatar";
import { parseIconConfig } from "@/lib/icons/parse";
import type { ChallengeProfile } from "@/lib/challenges/queries";
import { Mail } from "lucide-react";

interface OpponentAvatarProps {
  opponent: ChallengeProfile | null;
  opponentEmail?: string | null;
  /** Display name fallback for UserAvatar username prop */
  displayName: string;
  size: number;
}

/**
 * Renders the correct avatar for a challenge opponent:
 * - UserAvatar when the opponent has a profile
 * - Mail icon in a circle for email invite opponents
 * - Generic UserAvatar fallback otherwise
 */
export default function OpponentAvatar({
  opponent,
  opponentEmail,
  displayName,
  size,
}: OpponentAvatarProps) {
  if (opponent) {
    return (
      <UserAvatar
        avatarUrl={opponent.avatar_url}
        iconConfig={parseIconConfig(opponent.icon_config)}
        userId={opponent.id}
        username={opponent.username}
        size={size}
      />
    );
  }

  if (opponentEmail) {
    // Scale the mail icon relative to the avatar size
    const iconSize = Math.max(14, Math.round(size * 0.44));
    return (
      <div
        className="flex items-center justify-center rounded-full bg-muted"
        style={{ width: size, height: size }}
      >
        <Mail
          className="text-muted-foreground"
          style={{ width: iconSize, height: iconSize }}
        />
      </div>
    );
  }

  return (
    <UserAvatar
      avatarUrl={null}
      iconConfig={null}
      userId=""
      username={displayName}
      size={size}
    />
  );
}
