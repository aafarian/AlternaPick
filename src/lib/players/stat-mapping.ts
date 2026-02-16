import type { StatCategory } from "@/lib/supabase/types";
import type { GameLogEntry } from "@/lib/stats-service/client";

type GameLogField = keyof Pick<
  GameLogEntry,
  "points" | "rebounds" | "assists" | "threes_made" | "blocks" | "steals" | "turnovers"
>;

const CATEGORY_FIELDS: Partial<Record<StatCategory, GameLogField[]>> = {
  points: ["points"],
  rebounds: ["rebounds"],
  assists: ["assists"],
  threes: ["threes_made"],
  blocks: ["blocks"],
  steals: ["steals"],
  turnovers: ["turnovers"],
  pra: ["points", "rebounds", "assists"],
  pts_reb: ["points", "rebounds"],
  pts_ast: ["points", "assists"],
  reb_ast: ["rebounds", "assists"],
  blk_stl: ["blocks", "steals"],
};

/** Get the GameLogEntry field names relevant to a stat category. */
export function getGamelogFieldsForCategory(
  cat: StatCategory
): GameLogField[] {
  return CATEGORY_FIELDS[cat] ?? [];
}

/** Sum the relevant fields from a game log entry for a composite stat category. */
export function getCompositeValue(
  entry: GameLogEntry,
  cat: StatCategory
): number {
  const fields = getGamelogFieldsForCategory(cat);
  if (fields.length === 0) return 0;
  return fields.reduce((sum, field) => sum + (entry[field] as number), 0);
}
