import type { LivePickData } from "@/lib/cards/live-types";

export interface PickDisplayState {
  hasValue: boolean;
  isOver: boolean;
  isLive: boolean;
  isFinal: boolean;
  isPreGame: boolean;
  isAwaitingLive: boolean;
  isSettled: boolean;
  settledWon: boolean | null;
  inPlay: boolean;
  isWinning: boolean;
  isDnp: boolean;
  isVoid: boolean;
  barWidth: number;
  linePosition: number;
  barColor: string;
  accentClass: string;
}

export function computePickDisplay(pick: LivePickData): PickDisplayState {
  const hasValue = pick.current_value !== null;
  const isOver = pick.selection === "over";
  const isLive = pick.game_status?.status === "live";
  const isFinal = pick.game_status?.status === "final";

  // A game whose commence_time has passed but status is still "scheduled"
  // is stale data — the game likely started and the next poll will confirm.
  // Treat it as "awaiting live" (loading) instead of "pre-game" (showing
  // the stale time) so the user sees a spinner, not "Today 7:10 PM" for a
  // game that's already in progress.
  const scheduledButStarted =
    pick.game_status?.status === "scheduled" &&
    pick.game_status.commence_time != null &&
    new Date(pick.game_status.commence_time).getTime() < Date.now();

  const isPreGame =
    (!pick.game_status || pick.game_status.status === "scheduled") &&
    !scheduledButStarted;
  const isAwaitingLive =
    (!pick.game_status && !hasValue) || scheduledButStarted;

  const isDnp = pick.trending === "dnp";
  const isVoid = pick.trending === "push" && (isFinal || !pick.game_status);

  // Progress toward the line
  const rawPct =
    hasValue && pick.line > 0 ? (pick.current_value! / pick.line) * 100 : 0;
  const crossedLine = rawPct > 100;
  const isWinning = hasValue && (isOver ? rawPct > 100 : rawPct < 100);

  // Line marker fixed at 90%; bar scales within that range or fills 100% when over
  const linePosition = 90;
  const barWidth = crossedLine ? 100 : (rawPct / 100) * 90;

  // Settled: line is decided and won't change.
  // For Over picks, crossing the line mid-game is a guaranteed hit (stats only go up).
  // For Under picks, crossing the line mid-game is a guaranteed miss.
  // But we only settle on crossedLine if the game is actually live or final —
  // never on stale/missing game status alone.
  const crossedLineSettled = crossedLine && (isLive || isFinal);
  const isSettled =
    isDnp || isVoid ||
    (hasValue && isFinal) ||
    crossedLineSettled ||
    (pick.trending !== null && isFinal);

  const settledWon = isDnp || isVoid
    ? null
    : isSettled
      ? hasValue ? isWinning : pick.trending === "hit"
      : null;

  // Still in play: has live data but not settled yet
  const inPlay = isLive && !isSettled;

  // Bar color — green when winning, red when losing
  const barColor = !hasValue
    ? "bg-foreground/12"
    : isWinning
      ? "bg-neon-green/30"
      : "bg-bold-red/25";

  // Left accent border — only when settled; DNP/void get neutral muted styling
  const accentClass = isDnp || isVoid
    ? "border-l-muted-foreground/40"
    : isSettled
      ? settledWon
        ? "border-l-neon-green/60"
        : "border-l-bold-red/60"
      : "border-l-transparent";

  return {
    hasValue,
    isOver,
    isLive,
    isFinal,
    isPreGame,
    isAwaitingLive,
    isSettled,
    settledWon,
    inPlay,
    isWinning,
    isDnp,
    isVoid,
    barWidth,
    linePosition,
    barColor,
    accentClass,
  };
}
