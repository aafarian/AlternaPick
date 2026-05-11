/**
 * Barrel re-export of the sport configuration registry.
 * Does NOT re-export fetchers.ts (server-only) to keep client bundles clean.
 */
export {
  SPORT_KEYS,
  type SportKey,
  type CategoryOption,
  type HeadshotConfig,
  type SportConfig,
  SPORT_CONFIG,
  UI_SPORTS,
  SPORT_PRIORITY,
  GAMELOG_SPORTS,
  SPORT_LABELS,
  isValidSport,
  isSoccer,
  usesHalves,
  getSportCategories,
  getHeadshotConfig,
  getPlayerHeadshotUrl,
} from "./config";
