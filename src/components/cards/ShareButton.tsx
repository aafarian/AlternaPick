"use client";

import { useState } from "react";

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

      // Try native share API first (mobile), fall back to clipboard
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Check out my SportsTower card!",
            url: shareUrl,
          });
          setStatus("copied");
        } catch {
          // User cancelled share dialog — fall back to clipboard
          await navigator.clipboard.writeText(shareUrl);
          setStatus("copied");
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setStatus("copied");
      }

      // Reset after 2 seconds
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={status === "loading"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        status === "copied"
          ? "bg-green-500/20 text-green-400"
          : status === "error"
            ? "bg-red-500/20 text-red-400"
            : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
      }`}
    >
      {status === "loading" && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === "idle" && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
      {status === "copied" && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === "error" && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span>
        {status === "idle" && "Share"}
        {status === "loading" && "Sharing..."}
        {status === "copied" && "Link copied!"}
        {status === "error" && "Failed"}
      </span>
    </button>
  );
}
