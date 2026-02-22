import type { IconConfig } from "./types";
import {
  SHAPES,
  EMBLEM_IDS,
  BG_COLORS,
  BORDER_COLORS,
  EMBLEM_COLORS,
} from "./constants";

/* ---------- Hash Function (djb2) ---------- */

/**
 * Simple deterministic string hash using the djb2 algorithm.
 * Returns a 32-bit unsigned integer from any input string.
 */
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Derive multiple pseudo-random indices from a single hash by
 * mixing with different primes for each selection slot.
 */
function deriveIndex(h: number, slot: number, arrayLen: number): number {
  // Mix the hash with a slot-specific prime to get independent indices
  const primes = [73856093, 19349669, 83492791, 15485863, 32452843];
  const mixed = ((h ^ primes[slot % primes.length]) * (slot + 1)) >>> 0;
  return mixed % arrayLen;
}

/* ---------- Color Contrast Helpers ---------- */

/**
 * Parse a hex color string to an [r, g, b] tuple.
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ];
}

/**
 * Compute relative luminance of a color per WCAG 2.0.
 * Returns a value between 0 (darkest) and 1 (lightest).
 */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute WCAG contrast ratio between two colors.
 * Returns a value between 1 (identical) and 21 (max contrast).
 */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ---------- Internal Builder ---------- */

/**
 * Minimum contrast ratio for emblem on background.
 * WCAG AA requires 3:1 for large text / graphical elements.
 */
const MIN_EMBLEM_CONTRAST = 3;

/**
 * Minimum contrast ratio for border against background.
 * Lower threshold since the border is decorative, not informational.
 */
const MIN_BORDER_CONTRAST = 1.8;

/**
 * Build an IconConfig given a function that picks an index from an array.
 * This shared logic is used by both the seeded and pure-random generators.
 */
function buildConfig(pick: (arrayLen: number) => number): IconConfig {
  // 1. Shape -- straightforward pick
  const shape = SHAPES[pick(SHAPES.length)];

  // 2. Background color
  const bgColor = BG_COLORS[pick(BG_COLORS.length)];

  // 3. Border color -- pick one that contrasts with the background
  let borderIdx = pick(BORDER_COLORS.length);
  let borderColor = BORDER_COLORS[borderIdx];

  // Walk forward through border colors if contrast is too low
  for (let attempt = 0; attempt < BORDER_COLORS.length; attempt++) {
    if (contrastRatio(bgColor, borderColor) >= MIN_BORDER_CONTRAST) break;
    borderIdx = (borderIdx + 1) % BORDER_COLORS.length;
    borderColor = BORDER_COLORS[borderIdx];
  }

  // 4. Emblem
  const emblemId = EMBLEM_IDS[pick(EMBLEM_IDS.length)];

  // 5. Emblem color -- must have good contrast against background
  let emblemIdx = pick(EMBLEM_COLORS.length);
  let emblemColor = EMBLEM_COLORS[emblemIdx];

  // Walk forward through emblem colors to find one with sufficient contrast
  for (let attempt = 0; attempt < EMBLEM_COLORS.length; attempt++) {
    if (contrastRatio(bgColor, emblemColor) >= MIN_EMBLEM_CONTRAST) break;
    emblemIdx = (emblemIdx + 1) % EMBLEM_COLORS.length;
    emblemColor = EMBLEM_COLORS[emblemIdx];
  }

  return { shape, bgColor, borderColor, emblemId, emblemColor };
}

/* ---------- Public API ---------- */

/**
 * Generate a deterministic icon configuration from a seed string (e.g. user ID).
 * The same seed always produces the same IconConfig.
 */
export function generateRandomIcon(seed: string): IconConfig {
  const h = hash(seed);
  let slot = 0;
  return buildConfig((arrayLen) => deriveIndex(h, slot++, arrayLen));
}

/**
 * Generate a truly random icon configuration using Math.random().
 * Useful for a "Randomize" button in the icon builder UI.
 */
export function generateRandomIconPure(): IconConfig {
  return buildConfig((arrayLen) => Math.floor(Math.random() * arrayLen));
}
