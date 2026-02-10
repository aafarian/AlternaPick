"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Loader2, XCircle } from "lucide-react";

interface ShareButtonProps {
  cardId: string;
}

export default function ShareButton({ cardId }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function handleShare() {
    setStatus("loading");

    try {
      const response = await fetch(`/api/cards/${cardId}/share`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }

      const data = await response.json();
      const shareUrl: string = data.share_url;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "Check out my SportsTower card!",
            url: shareUrl,
          });
          setStatus("copied");
        } catch {
          await navigator.clipboard.writeText(shareUrl);
          setStatus("copied");
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setStatus("copied");
      }

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
