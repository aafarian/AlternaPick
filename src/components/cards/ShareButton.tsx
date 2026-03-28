"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Loader2, XCircle } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

interface ShareButtonProps {
  cardId: string;
}

/**
 * Card-specific share button.
 *
 * Generates a share token via the API (for legacy token-based links),
 * then shares or copies the OG-enabled share URL.
 */
export default function ShareButton({ cardId }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function handleShare() {
    setStatus("loading");

    try {
      // Hit the share API to ensure a share_token is generated
      const response = await fetch(`/api/cards/${cardId}/share`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }

      // Build the OG-enabled share URL
      const shareUrl = `${SITE_URL}/cards/share?id=${cardId}`;
      const shareTitle = "Check out my AlternaPick card!";
      const shareText = "See how I did on my NBA player prop picks!";

      // Try Web Share API first
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
          });
          setStatus("copied");
          setTimeout(() => setStatus("idle"), 2000);
          return;
        } catch {
          // User cancelled or API failed -- fall through to clipboard
        }
      }

      // Clipboard fallback
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleShare}
      disabled={status === "loading"}
      variant={status === "copied" ? "default" : status === "error" ? "destructive" : "secondary"}
      size="sm"
    >
      {status === "loading" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
      {status === "idle" && <Share2 className="mr-1.5 h-3.5 w-3.5" />}
      {status === "copied" && <Check className="mr-1.5 h-3.5 w-3.5" />}
      {status === "error" && <XCircle className="mr-1.5 h-3.5 w-3.5" />}
      {status === "idle" && "Share"}
      {status === "loading" && "Sharing..."}
      {status === "copied" && "Link copied!"}
      {status === "error" && "Failed"}
    </Button>
  );
}
