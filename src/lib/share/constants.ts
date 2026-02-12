/**
 * Shared constants for OG image generation.
 *
 * Colors mirror the app's dark theme with neon accents.
 * Dimensions follow the Open Graph standard (1200 x 630).
 */

// ---- Dimensions ----

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// ---- Color palette ----

export const colors = {
  /** Page / card background */
  darkBg: "#0a0a0b",
  /** Slightly lighter surface for panels */
  surface: "#1a1a2e",
  /** Elevated surface (picks row, badges) */
  surfaceElevated: "#252540",
  /** Primary accent -- neon green */
  neonGreen: "#00d26a",
  /** Secondary accent -- electric blue */
  electricBlue: "#3b82f6",
  /** Error / miss -- bold red */
  boldRed: "#ef4444",
  /** Winner highlight -- gold */
  gold: "#f59e0b",
  /** Primary text */
  textPrimary: "#f4f4f5",
  /** Secondary / muted text */
  textMuted: "#a1a1aa",
  /** Border color */
  border: "#27272a",
  /** White (for high-contrast elements) */
  white: "#ffffff",
} as const;

// ---- Font sizes (px) ----

export const fontSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 40,
  xxl: 56,
} as const;
