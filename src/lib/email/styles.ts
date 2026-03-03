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
    textDecoration: "none" as const,
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
} as const;
