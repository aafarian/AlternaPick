/* ---------- Icon System Types ---------- */

/** Background shape for the icon */
export type IconShape = "circle" | "shield" | "hexagon" | "diamond" | "square";

/** All available emblem identifiers */
export type EmblemId =
  | "lion"
  | "eagle"
  | "wolf"
  | "bear"
  | "hawk"
  | "snake"
  | "dragon"
  | "basketball"
  | "football"
  | "baseball"
  | "soccer"
  | "trophy"
  | "lightning"
  | "flame"
  | "star"
  | "crown"
  | "sword"
  | "shield-emblem"
  | "bolt"
  | "mountain"
  | "anchor"
  | "rocket"
  | "gem"
  | "paw";

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
}
