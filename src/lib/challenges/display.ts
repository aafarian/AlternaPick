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
