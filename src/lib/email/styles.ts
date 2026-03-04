/**
 * Shared email styles for all templates.
 * Clean, minimal transactional style to maximize inbox placement.
 */
export const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com";

export const emailStyles = {
  body: {
    backgroundColor: "#f4f4f5",
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
    color: "#18181b",
    margin: "0 0 16px 0",
    lineHeight: "1.3",
  },
  text: {
    fontSize: "15px",
    color: "#3f3f46",
    margin: "0 0 16px 0",
    lineHeight: "1.5",
  },
  link: {
    color: "#2563eb",
    textDecoration: "underline" as const,
    fontWeight: 500 as const,
  },
  hr: {
    borderColor: "#e4e4e7",
    margin: "24px 0 16px 0",
  },
  footer: {
    fontSize: "12px",
    color: "#a1a1aa",
    margin: "0",
    lineHeight: "1.5",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "32px",
    marginBottom: "16px",
  },
  button: {
    backgroundColor: "#18181b",
    color: "#ffffff",
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
    letterSpacing: "2px",
    padding: "16px 0",
    margin: "0",
    color: "#18181b",
  },
  buttonWrapper: {
    textAlign: "center" as const,
    marginTop: "8px",
  },
  accentWin: { color: "#16a34a" },
  accentLoss: { color: "#71717a" },
  accentTie: { color: "#0284c7" },
} as const;
