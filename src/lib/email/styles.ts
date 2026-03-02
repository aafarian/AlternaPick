/**
 * Shared email styles for all templates.
 * Dark theme matching the app aesthetic.
 */
export const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com";

export const emailStyles = {
  body: {
    backgroundColor: "#0a0a0a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: "0" as const,
    padding: "0" as const,
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  brand: {
    fontSize: "14px",
    fontWeight: 600 as const,
    color: "#a1a1aa",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    textAlign: "center" as const,
    margin: "0 0 32px 0",
  },
  headline: {
    fontSize: "32px",
    fontWeight: 700 as const,
    color: "#ffffff",
    textAlign: "center" as const,
    margin: "0 0 8px 0",
    lineHeight: "1.2",
  },
  scoreLine: {
    fontSize: "20px",
    color: "#e4e4e7",
    textAlign: "center" as const,
    margin: "0 0 4px 0",
  },
  subtext: {
    fontSize: "16px",
    color: "#71717a",
    textAlign: "center" as const,
    margin: "0 0 32px 0",
  },
  buttonSection: {
    textAlign: "center" as const,
    margin: "0 0 32px 0",
  },
  button: {
    backgroundColor: "#ffffff",
    color: "#0a0a0a",
    fontSize: "15px",
    fontWeight: 600 as const,
    textDecoration: "none",
    borderRadius: "8px",
    padding: "12px 32px",
  },
  hr: {
    borderColor: "#27272a",
    margin: "0 0 16px 0",
  },
  footer: {
    fontSize: "12px",
    color: "#52525b",
    textAlign: "center" as const,
    margin: "0",
    lineHeight: "1.5",
  },
} as const;
