/**
 * Score-tier messaging used by both in-app notifications and email templates.
 */
export function getCardTier(
  score: number,
  total: number,
): { headline: string; subtext: string } {
  const ratio = total > 0 ? score / total : 0;

  if (score === total) {
    return { headline: "Perfect Card!", subtext: "Absolute masterclass." };
  }
  if (ratio >= 0.8) {
    return { headline: "On Fire!", subtext: "Almost perfect." };
  }
  if (ratio >= 0.6) {
    return { headline: "Nice Card!", subtext: "Solid work." };
  }
  if (ratio >= 0.4) {
    return { headline: "Not Bad", subtext: "Room to improve." };
  }
  if (score > 0) {
    return { headline: "Tough Break", subtext: "Shake it off." };
  }
  return { headline: "Ice Cold", subtext: "Tomorrow's a new day." };
}
