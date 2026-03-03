import crypto from "crypto";
import type { StatCategory, PickSelection, PickResult } from "@/lib/supabase/types";
import { CATEGORY_LABELS } from "@/lib/constants";

/**
 * Generates a random 12-character alphanumeric share token.
 */
export function generateShareToken(): string {
  // Generate 9 random bytes (72 bits) and encode as base64url (12 chars)
  const bytes = crypto.randomBytes(9);
  return bytes
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12)
    .padEnd(12, "0");
}

/**
 * Constructs the public share URL for a given share token.
 */
export function getShareUrl(shareToken: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return `${origin}/picks/share/${shareToken}`;
}

interface PickSummaryInput {
  selection: PickSelection;
  result: PickResult;
  props?: {
    player_name: string;
    stat_category: string;
    line: number;
  } | null;
}

/**
 * Formats a text summary of a card's results for clipboard sharing.
 * Example: "I went 4/6 on my AlternaPick picks! LeBron James PTS O 25.5 ✓ ..."
 */
export function getCardShareSummary(
  score: number,
  totalPicks: number,
  picks: PickSummaryInput[],
  shareUrl: string
): string {
  const header = `I went ${score}/${totalPicks} on my AlternaPick picks!`;

  const pickLines = picks.map((pick) => {
    const playerName = pick.props?.player_name ?? "Unknown";
    const cat =
      CATEGORY_LABELS[pick.props?.stat_category as StatCategory] ??
      pick.props?.stat_category ??
      "?";
    const dir = pick.selection === "over" ? "O" : "U";
    const line = pick.props?.line ?? "?";
    const icon = pick.result === "hit" ? "+" : pick.result === "miss" ? "-" : pick.result === "dnp" ? "\u2205" : pick.result === "push" ? "~" : "?";
    return `${icon} ${playerName} ${cat} ${dir} ${line}`;
  });

  return `${header}\n${pickLines.join("\n")}\n${shareUrl}`;
}
