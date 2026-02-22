/* ---------- Icon System Types ---------- */

/** Background shape for the icon */
export type IconShape = "circle" | "shield" | "hexagon" | "diamond" | "square";

/** Emblem category groupings */
export type EmblemCategory = "animals" | "sports" | "symbols";

/** All available emblem identifiers */
export type EmblemId =
  // Animals
  | "lion"
  | "eagle"
  | "wolf"
  | "bear"
  | "hawk"
  | "snake"
  | "dragon"
  // Sports
  | "basketball"
  | "football"
  | "baseball"
  | "soccer"
  | "trophy"
  | "lightning"
  | "flame"
  // Symbols
  | "star"
  | "crown"
  | "sword"
  | "shield-emblem"
  | "bolt";

/**
 * Icon configuration — serializes to JSON for JSONB storage in Supabase.
 * All color values are hex strings (e.g. "#1a1a2e").
 */
export interface IconConfig {
  shape: IconShape;
  bgColor: string;
  borderColor: string;
  emblemId: EmblemId;
  emblemColor: string;
}

/** Metadata entry for an emblem in the emblem library */
export interface EmblemMeta {
  id: EmblemId;
  label: string;
  category: EmblemCategory;
}
