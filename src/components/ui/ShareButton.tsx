"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";

interface ShareButtonProps {
  /** The full URL to share */
  url: string;
  /** Title for the Web Share API */
  title: string;
  /** Description text for the Web Share API */
  text: string;
  /** Optional className override */
  className?: string;
}

/**
 * Generic share button that tries Web Share API first,
 * then falls back to clipboard copy with a brief "Copied!" indicator.
 */
export default function ShareButton({
  url,
  title,
  text,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Try Web Share API first (mobile, some desktop browsers)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or API failed -- fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: prompt-based fallback (very old browsers)
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleShare}
      variant={copied ? "default" : "secondary"}
      size="sm"
      className={className}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Share
        </>
      )}
    </Button>
  );
}
