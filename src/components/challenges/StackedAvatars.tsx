import UserAvatar from "@/components/icons/UserAvatar";
import { parseIconConfig } from "@/lib/icons/parse";
import type { ParticipantAvatar } from "@/lib/challenges/queries";

/** Maximum number of visible avatars before showing "+N" overflow. */
const MAX_VISIBLE = 3;

interface StackedAvatarsProps {
  participants: ParticipantAvatar[];
  size: number;
}

/**
 * Renders overlapping participant avatars for group challenge cards.
 * Shows up to 3 avatars with negative margin overlap, plus a "+N"
 * overflow indicator when there are more participants.
 */
export default function StackedAvatars({
  participants,
  size,
}: StackedAvatarsProps) {
  const visible = participants.slice(0, MAX_VISIBLE);
  const overflow = participants.length - MAX_VISIBLE;
  // Overlap each avatar by ~30% of its width
  const overlapMargin = Math.round(size * -0.3);
  const fontSize = Math.max(9, Math.round(size * 0.32));

  return (
    <div className="flex items-center" style={{ paddingLeft: 0 }}>
      {visible.map((p, i) => (
        <div
          key={p.user_id ?? `guest-${i}`}
          className="relative rounded-full ring-2 ring-background"
          style={{ marginLeft: i === 0 ? 0 : overlapMargin, zIndex: MAX_VISIBLE - i }}
        >
          <UserAvatar
            avatarUrl={p.avatar_url}
            iconConfig={parseIconConfig(p.icon_config)}
            userId={p.user_id ?? ""}
            username={p.display_name || p.username || "?"}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative flex items-center justify-center rounded-full bg-muted ring-2 ring-background"
          style={{
            width: size,
            height: size,
            marginLeft: overlapMargin,
            zIndex: 0,
            fontSize,
          }}
        >
          <span className="font-semibold text-muted-foreground">
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}
