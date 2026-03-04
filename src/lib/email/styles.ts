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
  zinc100: "#f4f4f5",
  white: "#ffffff",
  sky600: "#0284c7",
  green600: "#16a34a",
} as const;

export const emailStyles = {
  body: {
    backgroundColor: colors.zinc100,
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
  card: {
    backgroundColor: colors.white,
    borderRadius: "12px",
    padding: "32px",
    marginBottom: "16px",
  },
  button: {
    backgroundColor: colors.zinc950,
    color: colors.white,
    padding: "12px 24px",
    borderRadius: "8px",
    textDecoration: "none" as const,
    fontWeight: 600 as const,
    display: "inline-block" as const,
    fontSize: "15px",
  },
  scoreBlock: {
    fontSize: "36px",
    fontWeight: 700 as const,
    textAlign: "center" as const,
    padding: "16px 0",
    margin: "0",
    color: colors.zinc950,
  },
  buttonWrapper: {
    textAlign: "center" as const,
    marginTop: "8px",
  },
  accentWin: { color: colors.green600 },
  accentLoss: { color: colors.zinc500 },
  accentTie: { color: colors.sky600 },
} as const;
