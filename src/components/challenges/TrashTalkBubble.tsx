"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TrashTalkBubbleProps {
  message: string;
  senderName: string;
  senderAvatar?: string | null;
}

/**
 * Speech-bubble component that displays a challenger's trash talk message.
 * Only renders when message is non-empty.
 */
export default function TrashTalkBubble({
  message,
  senderName,
  senderAvatar,
}: TrashTalkBubbleProps) {
  if (!message) return null;

  const initial = senderName.charAt(0).toUpperCase();

  return (
    <div className="flex items-start gap-3">
      {/* Sender avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {senderAvatar && <AvatarImage src={senderAvatar} alt={senderName} />}
        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
          {initial}
        </AvatarFallback>
      </Avatar>

      {/* Speech bubble */}
      <div className="relative flex-1">
        {/* Bubble tail */}
        <div className="absolute -left-2 top-3 h-3 w-3 rotate-45 border-b-0 border-r-0 border-l border-t border-border bg-secondary/50" />

        <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3">
          {/* Sender name */}
          <p className="mb-1 text-xs font-semibold text-muted-foreground">
            {senderName}
          </p>
          {/* Message */}
          <p className="text-sm italic text-foreground leading-relaxed">
            &ldquo;{message}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
