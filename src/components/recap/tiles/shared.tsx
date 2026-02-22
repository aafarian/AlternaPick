import {
  AlertTriangle,
  Check,
  Flame,
  Snowflake,
  TrendingUp,
  TrendingDown,
  Trophy,
  Users,
  Shield,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { isValidSport, SPORT_CONFIG } from "@/lib/sports/config";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { SpotlightType } from "@/lib/recaps/compute";

/* ─── Constants ─── */

export const TILE =
  "rounded-xl border p-4 flex flex-col justify-between min-h-[160px]";

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

/* ─── Helpers ─── */

export function catLabel(key: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[key] ?? key;
}
