import type { IconConfig } from "./types";
import { SHAPES, EMBLEM_IDS } from "./constants";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates and parses a raw value (typically from the database JSONB column)
 * into a typed IconConfig. Returns null if the value is missing or malformed.
 */
export function parseIconConfig(raw: unknown): IconConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const shape = obj.shape;
  const emblemId = obj.emblemId;
  const bgColor = obj.bgColor;
  const borderColor = obj.borderColor;
  const emblemColor = obj.emblemColor;

  if (
    typeof shape !== "string" ||
    !SHAPES.includes(shape as any) ||
    typeof emblemId !== "string" ||
    !EMBLEM_IDS.includes(emblemId as any) ||
    typeof bgColor !== "string" ||
    !HEX_RE.test(bgColor) ||
    typeof borderColor !== "string" ||
    !HEX_RE.test(borderColor) ||
    typeof emblemColor !== "string" ||
    !HEX_RE.test(emblemColor)
  ) {
    return null;
  }

  return { shape, emblemId, bgColor, borderColor, emblemColor } as IconConfig;
}
