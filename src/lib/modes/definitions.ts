import type { GameMode, GameModeDefinition } from "./types";

/**
 * Central registry of all game modes.
 *
 * Keyed by mode string so callers can look up metadata in O(1).
 * `GAME_MODE_LIST` is a derived array for UI iteration (stable order).
 */

export const GAME_MODES: Record<GameMode, GameModeDefinition> = {
  classic: {
    key: "classic",
    displayName: "Classic",
    description: "Standard head-to-head. Both players build their own card.",
    icon: "\uD83C\uDFC0", // basketball
    rules:
      "Each player independently selects their picks and locks their card. " +
      "The player with the most correct picks wins.",
    constraints: {},
  },

  sabotage: {
    key: "sabotage",
    displayName: "Sabotage",
    description: "Pick your opponent's card. Try to give them bad lines.",
    icon: "\uD83D\uDCA3", // bomb
    rules:
      "You build a card that your opponent will be stuck with, and they do the same for you. " +
      "When both cards are locked the picks swap, so pick the worst lines you can find.",
    constraints: { swapCards: true },
  },

  mirror: {
    key: "mirror",
    displayName: "Mirror",
    description: "Same props, different calls. Who reads the lines better?",
    icon: "\uD83E\uDE9E", // mirror
    rules:
      "Both players see the exact same set of props. Each independently picks over or under on every line. " +
      "The player who gets more right wins.",
    constraints: { sharedProps: true },
  },

  random: {
    key: "random",
    displayName: "Random",
    description: "System picks your props. Just call over or under.",
    icon: "\uD83C\uDFB2", // dice
    rules:
      "The system randomly selects props for you. You just pick over or under on each line.",
    constraints: { sharedProps: true },
  },

  one_player: {
    key: "one_player",
    displayName: "One Player",
    description: "All picks from a single NBA player.",
    icon: "\uD83C\uDFAF", // bullseye
    rules:
      "Every pick on the card must come from the same player. " +
      "Once you select your first prop, only that player's remaining lines are available.",
    constraints: { samePlayer: true },
  },

  one_team: {
    key: "one_team",
    displayName: "One Team",
    description: "All picks from players on one NBA team.",
    icon: "\uD83D\uDC51", // crown
    rules:
      "Every pick must come from a player on the same NBA team. " +
      "Once you select your first prop, only that team's players are available.",
    constraints: { sameTeam: true },
  },
};

/** Ordered list of all mode definitions for UI iteration. */
export const GAME_MODE_LIST: GameModeDefinition[] = [
  GAME_MODES.classic,
  GAME_MODES.sabotage,
  GAME_MODES.mirror,
  GAME_MODES.random,
  GAME_MODES.one_player,
  GAME_MODES.one_team,
];

/** All valid mode key strings (useful for runtime validation). */
export const GAME_MODE_KEYS: GameMode[] = GAME_MODE_LIST.map((m) => m.key);

/**
 * Look up the full mode definition for a given key.
 * Returns undefined for invalid keys so callers can handle gracefully.
 */
export function getModeConfig(
  mode: GameMode
): GameModeDefinition {
  return GAME_MODES[mode];
}

/**
 * Returns true for modes that constrain which props can be picked
 * (one_player and one_team).
 */
export function isConstrainedMode(mode: GameMode): boolean {
  return mode === "one_player" || mode === "one_team";
}

/**
 * Returns true if the given string is a valid GameMode key.
 * Useful for server-side validation of untrusted input.
 */
export function isValidGameMode(value: string): value is GameMode {
  return (GAME_MODE_KEYS as string[]).includes(value);
}
