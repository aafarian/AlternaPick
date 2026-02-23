// ---------------------------------------------------------------------------
// Shared helper functions for admin components and routes.
//
// These were previously duplicated across UserDetail, ChallengeDetail,
// CardDetail, ActivityFeed, UsersTable, RecordLookup, and SystemHealth.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------

/** Format as "MMM D, YYYY" (e.g. "Jan 15, 2026"). Returns em-dash for falsy input. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format as "MMM D, YYYY h:mm a" (e.g. "Jan 15, 2026 3:30 PM"). Returns em-dash for falsy input. */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Relative time string: "just now", "Xm ago", "Xh ago", "Xd ago",
 * or formatted date (e.g. "Jan 15") if more than 7 days ago.
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d ago`;

  // Older than 7 days — show formatted date
  const date = new Date(dateStr);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// ---------------------------------------------------------------------------
// Game mode / stat category labels
// ---------------------------------------------------------------------------

/**
 * Canonical game mode label covering ALL modes:
 * classic, sabotage, mirror, random, one_player, one_team, turbo, playoff, h2h.
 * Returns a title-cased fallback for unknown modes.
 */
export function gameModeLabel(mode: string | null): string {
  if (!mode) return "\u2014";
  switch (mode) {
    case "classic":
      return "Classic";
    case "sabotage":
      return "Sabotage";
    case "mirror":
      return "Mirror";
    case "random":
      return "Random";
    case "one_player":
      return "One Player";
    case "one_team":
      return "One Team";
    case "turbo":
      return "Turbo";
    case "playoff":
      return "Playoff";
    case "h2h":
      return "H2H";
    default:
      // Title-case fallback: "some_mode" -> "Some Mode"
      return mode
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

/**
 * Abbreviation-style stat category label (PTS, REB, AST, etc.).
 * Includes all basketball and soccer categories.
 * Falls back to title-cased input for unknown categories.
 */
export function statCategoryLabel(cat: string): string {
  switch (cat) {
    // Basketball
    case "points":
      return "PTS";
    case "rebounds":
      return "REB";
    case "assists":
      return "AST";
    case "threes":
      return "3PM";
    case "blocks":
      return "BLK";
    case "steals":
      return "STL";
    case "turnovers":
      return "TO";
    case "pra":
      return "PRA";
    case "pts_reb":
      return "P+R";
    case "pts_ast":
      return "P+A";
    case "reb_ast":
      return "R+A";
    case "blk_stl":
      return "B+S";
    // Soccer
    case "shots":
      return "SH";
    case "shots_on_target":
      return "SOT";
    case "tackles":
      return "TKL";
    case "passes":
      return "PAS";
    case "goals":
      return "G";
    case "fouls_committed":
      return "FLS";
    case "saves":
      return "SAV";
    default:
      // Title-case fallback: "some_stat" -> "Some Stat"
      return cat
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

// ---------------------------------------------------------------------------
// Status variant helpers (for Badge components)
// ---------------------------------------------------------------------------

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

/** Returns a badge variant string for card statuses. */
export function cardStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "draft":
      return "secondary";
    case "locked":
      return "default";
    case "resolved":
      return "outline";
    default:
      return "secondary";
  }
}

/** Returns a badge variant string for challenge statuses. */
export function challengeStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "pending":
      return "secondary";
    case "accepted":
      return "default";
    case "active":
      return "default";
    case "resolved":
      return "outline";
    case "declined":
      return "destructive";
    case "cancelled":
      return "secondary";
    default:
      return "secondary";
  }
}

// ---------------------------------------------------------------------------
// Pick result styling
// ---------------------------------------------------------------------------

/** Returns Tailwind classes for pick result badges (hit=green, miss=red, pending=muted). */
export function pickResultClasses(result: string | null): string {
  switch (result) {
    case "hit":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "miss":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "pending":
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

/**
 * Extract 1-2 character initials from a name.
 * For multi-word names, uses first letter of first two words.
 * For single-word names, uses first two characters.
 */
export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// UUID validation
// ---------------------------------------------------------------------------

/** UUID v4 regex for validation. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Check whether a string is a valid UUID. */
export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}
