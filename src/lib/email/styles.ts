/**
 * Shared email styles for all templates.
 *
 * Design principles:
 * - Clean, modern transactional style that encourages interaction
 * - No images — avoids broken renders and spam triggers
 * - Text-forward with strategic visual accents (score cards, colored CTAs)
 * - Single CTA per email to drive engagement
 * - Deliverability-safe: minimal HTML, no background colors on body
 */

// Re-export for backward compatibility — templates import baseUrl from here
export { baseUrl } from "./config";

export const colors = {
  white: "#ffffff",
  zinc950: "#09090b",
  zinc700: "#3f3f46",
  zinc600: "#52525b",
  zinc500: "#71717a",
  zinc400: "#a1a1aa",
  zinc200: "#e4e4e7",
  zinc100: "#f4f4f5",
  zinc50: "#fafafa",
  green600: "#16a34a",
  green50: "#f0fdf4",
  red50: "#fef2f2",
  sky700: "#0369a1",
  sky600: "#0284c7",
  sky50: "#f0f9ff",
} as const;

export const emailStyles = {
  body: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: "0" as const,
    padding: "0" as const,
    backgroundColor: colors.zinc100,
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "0",
    backgroundColor: colors.white,
  },
  content: {
    padding: "32px 28px",
  },
  /** Branded header bar at the top of every email */
  header: {
    backgroundColor: colors.zinc950,
    padding: "16px 28px",
  },
  headerText: {
    fontSize: "15px",
    fontWeight: 700 as const,
    color: colors.white,
    margin: "0",
    letterSpacing: "0.02em",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 700 as const,
    color: colors.zinc950,
    margin: "0 0 8px 0",
    lineHeight: "1.3",
  },
  subheading: {
    fontSize: "14px",
    fontWeight: 500 as const,
    color: colors.zinc500,
    margin: "0 0 4px 0",
    lineHeight: "1.4",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  text: {
    fontSize: "15px",
    color: colors.zinc700,
    margin: "0 0 20px 0",
    lineHeight: "1.6",
  },
  muted: {
    fontSize: "14px",
    color: colors.zinc500,
    margin: "0 0 20px 0",
    lineHeight: "1.6",
    fontStyle: "italic" as const,
  },
  /** Wrapper to center a CTA button */
  buttonWrapper: {
    textAlign: "center" as const,
  },
  /** Primary CTA button */
  button: {
    backgroundColor: colors.zinc950,
    color: colors.white,
    fontSize: "15px",
    fontWeight: 600 as const,
    padding: "12px 28px",
    borderRadius: "8px",
    textDecoration: "none" as const,
    textAlign: "center" as const,
    display: "inline-block" as const,
  },
  /** Score display card with subtle background */
  scoreCard: {
    backgroundColor: colors.zinc50,
    borderRadius: "12px",
    padding: "20px",
    margin: "0 0 20px 0",
    textAlign: "center" as const,
  },
  scoreBlock: {
    fontSize: "40px",
    fontWeight: 800 as const,
    textAlign: "center" as const,
    padding: "0",
    margin: "0 0 4px 0",
    letterSpacing: "-0.03em",
    color: colors.zinc950,
    lineHeight: "1.1",
  },
  scoreLabel: {
    fontSize: "13px",
    fontWeight: 500 as const,
    color: colors.zinc500,
    textAlign: "center" as const,
    margin: "0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  hr: {
    borderColor: colors.zinc200,
    margin: "0",
  },
  footer: {
    fontSize: "12px",
    color: colors.zinc400,
    margin: "0",
    lineHeight: "1.5",
    padding: "16px 28px",
  },
  footerLink: {
    color: colors.sky600,
    textDecoration: "underline" as const,
  },
  /** Outcome-specific accent colors */
  accentWin: { color: colors.green600 },
  accentLoss: { color: colors.zinc600 },
  accentTie: { color: colors.sky700 },
  /** Score card background variants */
  scoreCardWin: { backgroundColor: colors.green50 },
  scoreCardLoss: { backgroundColor: colors.red50 },
  scoreCardTie: { backgroundColor: colors.sky50 },
} as const;
