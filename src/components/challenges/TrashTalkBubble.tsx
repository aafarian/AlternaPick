"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, MessageCircle } from "lucide-react";

interface TrashTalkBubbleProps {
  message: string;
  senderName: string;
  senderAvatar?: string | null;
}

/**
 * Dismissible chat-like trash talk bubble.
 * Shows as a collapsible panel that can be closed and re-opened.
 */
export default function TrashTalkBubble({
  message,
  senderName,
  senderAvatar,
}: TrashTalkBubbleProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!message) return null;

  const initial = senderName.charAt(0).toUpperCase();

  // Collapsed state — small floating pill to re-open
  if (dismissed) {
    return (
      <button
        onClick={() => setDismissed(false)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Trash Talk
      </button>
    );
  }

  return (
    <div className="relative rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Dismiss trash talk"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {/* Sender avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          {senderAvatar && <AvatarImage src={senderAvatar} alt={senderName} />}
          <AvatarFallback className="bg-amber-500/20 text-xs font-bold text-amber-400">
            {initial}
          </AvatarFallback>
        </Avatar>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          <p className="mb-0.5 text-xs font-semibold text-amber-400">
            {senderName}
          </p>
          <p className="text-sm italic text-foreground leading-relaxed">
            &ldquo;{message}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
