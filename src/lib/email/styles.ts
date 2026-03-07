/**
 * Shared email styles for all templates.
 * Clean, minimal transactional style to maximize inbox placement.
 */
export const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com";

/** Reusable color palette — single source of truth for email hex values. */
const colors = {
  zinc950: "#18181b",
  zinc700: "#3f3f46",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc200: "#e4e4e7",
  sky700: "#0369a1",
  sky600: "#0284c7",
  green600: "#16a34a",
} as const;

export const emailStyles = {
  body: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: "0" as const,
    padding: "0" as const,
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "32px 24px",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 600 as const,
    color: colors.zinc950,
    margin: "0 0 16px 0",
    lineHeight: "1.3",
  },
  text: {
    fontSize: "15px",
    color: colors.zinc700,
    margin: "0 0 16px 0",
    lineHeight: "1.5",
  },
  hr: {
    borderColor: colors.zinc200,
    margin: "24px 0 16px 0",
  },
  footer: {
    fontSize: "12px",
    color: colors.zinc400,
    margin: "0",
    lineHeight: "1.5",
  },
  button: {
    color: colors.sky700,
    textDecoration: "underline" as const,
    fontWeight: 600 as const,
    fontSize: "15px",
  },
  scoreBlock: {
    fontSize: "24px",
    fontWeight: 600 as const,
    textAlign: "center" as const,
    padding: "8px 0",
    margin: "0",
    color: colors.zinc950,
  },
  accentWin: { color: colors.green600 },
  accentLoss: { color: colors.zinc500 },
  accentTie: { color: colors.sky600 },
} as const;
