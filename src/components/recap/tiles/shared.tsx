import {
  AlertTriangle,
  Check,
  Flame,
  Minus,
  Snowflake,
  TrendingUp,
  TrendingDown,
  Trophy,
  Users,
  Shield,
  BarChart3,
  X,
  type LucideIcon,
} from "lucide-react";
import { isValidSport, SPORT_CONFIG } from "@/lib/sports/config";
import { CATEGORY_LABELS, catLabel } from "@/lib/constants";
import type { SpotlightType } from "@/lib/recaps/compute";

/* ─── Click callbacks ─── */

export interface PropClickInfo {
  propId: string;
  playerName: string;
  statCategory: string;
  line: number;
}

export type OnPropClick = (info: PropClickInfo) => void;

export interface PlayerClickInfo {
  playerName: string;
  sport?: string;
  statCategory?: string;
}

export type OnPlayerClick = (info: PlayerClickInfo) => void;

/* ─── Constants ─── */

/** Base tile style — content anchored to top with consistent gap */
const TILE_BASE = "rounded-xl border p-4 flex flex-col gap-3 min-h-[160px]";

/** Clickable tile — hover lift + shadow for interactive tiles */
export const TILE = `${TILE_BASE} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20`;

/** Static tile — no hover effects, for display-only tiles */
export const TILE_STATIC = TILE_BASE;

export const MAX_TILE_ITEMS = 3;
export const MAX_TILE_ITEMS_LARGE = 5;

/* ─── Color configs for spotlights ─── */

export interface SpotlightStyle {
  icon: LucideIcon;
  bg: string;
  border: string;
  iconColor: string;
  valueColor: string;
}

export const spotlightConfig: Record<SpotlightType, SpotlightStyle> = {
  player_trap: {
    icon: AlertTriangle,
    bg: "bg-bold-red/5",
    border: "border-bold-red/20",
    iconColor: "text-bold-red",
    valueColor: "text-bold-red",
  },
  player_lock: {
    icon: Check,
    bg: "bg-neon-green/5",
    border: "border-neon-green/20",
    iconColor: "text-neon-green",
    valueColor: "text-neon-green",
  },
  prop_unanimous: {
    icon: Users,
    bg: "bg-electric-blue/5",
    border: "border-electric-blue/20",
    iconColor: "text-electric-blue",
    valueColor: "text-electric-blue",
  },
  category_hot: {
    icon: Flame,
    bg: "bg-neon-green/5",
    border: "border-neon-green/20",
    iconColor: "text-neon-green",
    valueColor: "text-neon-green",
  },
  category_cold: {
    icon: Snowflake,
    bg: "bg-bold-red/5",
    border: "border-bold-red/20",
    iconColor: "text-bold-red",
    valueColor: "text-bold-red",
  },
  team_hot: {
    icon: Shield,
    bg: "bg-neon-green/5",
    border: "border-neon-green/20",
    iconColor: "text-neon-green",
    valueColor: "text-neon-green",
  },
  team_cold: {
    icon: Shield,
    bg: "bg-bold-red/5",
    border: "border-bold-red/20",
    iconColor: "text-bold-red",
    valueColor: "text-bold-red",
  },
  over_under_skew: {
    icon: TrendingUp,
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
    valueColor: "text-amber-400",
  },
  perfect_cards: {
    icon: Trophy,
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
    valueColor: "text-amber-400",
  },
  consensus_upset: {
    icon: TrendingDown,
    bg: "bg-bold-red/5",
    border: "border-bold-red/20",
    iconColor: "text-bold-red",
    valueColor: "text-bold-red",
  },
  most_picked: {
    icon: TrendingUp,
    bg: "bg-electric-blue/5",
    border: "border-electric-blue/20",
    iconColor: "text-electric-blue",
    valueColor: "text-electric-blue",
  },
  sport_hot: {
    icon: BarChart3,
    bg: "bg-neon-green/5",
    border: "border-neon-green/20",
    iconColor: "text-neon-green",
    valueColor: "text-neon-green",
  },
  sport_cold: {
    icon: BarChart3,
    bg: "bg-bold-red/5",
    border: "border-bold-red/20",
    iconColor: "text-bold-red",
    valueColor: "text-bold-red",
  },
};

export const PLAYER_TYPES: SpotlightType[] = [
  "player_trap",
  "player_lock",
  "prop_unanimous",
  "consensus_upset",
  "most_picked",
];

/* ─── Shared sub-components ─── */

export function TileHeader({
  icon: Icon,
  label,
  textColor,
}: {
  icon: LucideIcon;
  label: string;
  textColor: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-4 w-4 ${textColor}`} />
      <span
        className={`text-xs font-bold uppercase tracking-widest ${textColor}`}
      >
        {label}
      </span>
    </div>
  );
}

export function TilePill({
  bgColor,
  left,
  right,
  rightColor,
}: {
  bgColor: string;
  left: React.ReactNode;
  right: React.ReactNode;
  rightColor: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg ${bgColor} px-3 py-2`}
    >
      <div className="min-w-0 flex-1">
        {typeof left === "string" ? (
          <p className="text-xs font-semibold text-foreground">{left}</p>
        ) : (
          left
        )}
      </div>
      <span
        className={`text-xs font-bold tabular-nums ${rightColor} shrink-0`}
      >
        {right}
      </span>
    </div>
  );
}

export function SportBadge({ sport }: { sport: string }) {
  if (!isValidSport(sport)) return null;
  const cfg = SPORT_CONFIG[sport];
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <span>{cfg.icon}</span>
      <span>{cfg.shortLabel}</span>
    </span>
  );
}

/* ─── Modal shared types & components ─── */

export interface PickerInfo {
  username: string;
  selection: string;
  result: string;
  actualValue: number | null;
}

export function sportLabel(sport: string): string {
  if (isValidSport(sport)) return SPORT_CONFIG[sport].shortLabel;
  return sport.toUpperCase();
}

export function ResultIcon({
  result,
  size = "sm",
}: {
  result: string;
  size?: "sm" | "md";
}) {
  const outer = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const inner = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  if (result === "hit") {
    return (
      <div className={`flex ${outer} items-center justify-center rounded-full bg-neon-green/20 shrink-0`}>
        <Check className={`${inner} text-neon-green`} />
      </div>
    );
  }
  if (result === "miss") {
    return (
      <div className={`flex ${outer} items-center justify-center rounded-full bg-bold-red/20 shrink-0`}>
        <X className={`${inner} text-bold-red`} />
      </div>
    );
  }
  return (
    <div className={`flex ${outer} items-center justify-center rounded-full bg-border/40 shrink-0`}>
      <Minus className={`${inner} text-muted-foreground`} />
    </div>
  );
}

export function hitRateColor(rate: number): string {
  if (rate >= 0.6) return "text-neon-green";
  if (rate >= 0.4) return "text-electric-blue";
  return "text-bold-red";
}

export function hitRateBg(rate: number): string {
  if (rate >= 0.6) return "bg-neon-green/5";
  if (rate >= 0.4) return "bg-electric-blue/5";
  return "bg-bold-red/5";
}

/* ─── Helpers ─── */

// Re-export for convenience — canonical implementation lives in @/lib/constants
export { catLabel } from "@/lib/constants";

/** Matches any raw CATEGORY_LABELS key as a whole word (case-insensitive). */
const RAW_STAT_RE = new RegExp(
  `\\b(${Object.keys(CATEGORY_LABELS).join("|")})\\b`,
  "gi",
);

/**
 * Sanitise pre-computed spotlight text so cached DB rows render correctly.
 * - Replaces raw stat_category keys (e.g. "Pts_ast", "threes") with human labels
 * - Replaces "only 0%" with "0%" (reserve "only" for low-but-nonzero rates)
 */
export function sanitizeSpotlightText(text: string): string {
  let out = text.replace(RAW_STAT_RE, (match) => catLabel(match));
  out = out.replace(/\b[Oo]nly 0%/g, "0%");
  out = out.replace(/^All 2 chose/, "2 people chose");
  return out;
}
