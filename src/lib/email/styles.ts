/**
 * Shared email styles for all templates.
 * Minimal, text-forward transactional style to maximize inbox placement.
 * Avoids heavy HTML, background colors, and marketing patterns.
 */
export const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com";

const colors = {
  white: "#ffffff",
  zinc950: "#09090b",
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
    backgroundColor: colors.white,
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  accentBar: {
    height: "3px",
    backgroundColor: colors.sky600,
    borderRadius: "2px",
    margin: "0 0 32px 0",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 700 as const,
    color: colors.zinc950,
    margin: "0 0 8px 0",
    lineHeight: "1.3",
  },
  text: {
    fontSize: "15px",
    color: colors.zinc700,
    margin: "0 0 20px 0",
    lineHeight: "1.6",
  },
  muted: {
    fontSize: "14px",
    color: colors.zinc400,
    margin: "0 0 20px 0",
    lineHeight: "1.6",
    fontStyle: "italic" as const,
  },
  link: {
    color: colors.sky700,
    textDecoration: "none" as const,
    fontWeight: 500 as const,
    fontSize: "14px",
  },
  button: {
    backgroundColor: colors.sky600,
    color: colors.white,
    fontSize: "14px",
    fontWeight: 600 as const,
    padding: "10px 24px",
    borderRadius: "6px",
    textDecoration: "none" as const,
  },
  hr: {
    borderColor: colors.zinc200,
    margin: "28px 0 16px 0",
  },
  footer: {
    fontSize: "12px",
    color: colors.zinc400,
    margin: "0",
    lineHeight: "1.5",
  },
  scoreBlock: {
    fontSize: "36px",
    fontWeight: 700 as const,
    textAlign: "center" as const,
    padding: "16px 0",
    margin: "0 0 8px 0",
    letterSpacing: "-0.02em",
    color: colors.zinc950,
  },
  accentWin: { color: colors.green600 },
  accentLoss: { color: colors.zinc500 },
  accentTie: { color: colors.sky700 },
} as const;
