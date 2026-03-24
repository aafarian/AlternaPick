import { maskEmail } from "@/lib/format";
import type { ChallengeProfile } from "@/lib/challenges/queries";

/**
 * Resolves a display name for an opponent, falling back through:
 * 1. Profile display_name / username (if opponent exists)
 * 2. Masked email (if email invite)
 * 3. "Invited" (generic fallback)
 */
export function getOpponentDisplayName(
  opponent: ChallengeProfile | null,
  opponentEmail: string | null | undefined,
): string {
  if (opponent) return opponent.display_name || opponent.username;
  if (opponentEmail) return maskEmail(opponentEmail);
  return "Invited";
}

/**
 * Returns the ordinal suffix for a placement number.
 * e.g., 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th"
 */
export function formatPlacement(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}
