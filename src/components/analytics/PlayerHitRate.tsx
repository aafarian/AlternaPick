"use client";

import type { PlayerStats } from "@/lib/analytics/types";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { SPORT_LABELS, isValidSport, getPlayerHeadshotUrl } from "@/lib/sports";

interface PlayerHitRateProps {
  data: PlayerStats[];
}

function SportBadge({ sport }: { sport?: string }) {
  if (!sport || !isValidSport(sport)) return null;
  return (
    <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
      {SPORT_LABELS[sport]}
    </span>
  );
}

function PlayerAvatar({ name, playerId, sport, size = 32 }: { name: string; playerId?: string | null; sport?: string; size?: number }) {
  const url = playerId ? getPlayerHeadshotUrl(playerId, sport) : "";
  const parts = name.split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);

  return (
    <div
      className="shrink-0 overflow-hidden rounded-full bg-white/[0.08]"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
          {initials.toUpperCase()}
        </div>
      )}
    </div>
  );
}

export default function PlayerHitRate({ data }: PlayerHitRateProps) {
  if (data.length === 0) return null;

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Top Players</h2>

      {/* Podium — top 3 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {top3.map((player, i) => {
          const pct = Math.round(player.rate * 100);
          const color = rateColor(pct);

          return (
            <div
              key={player.player_name}
              className="relative flex flex-col items-center overflow-hidden rounded-xl bg-white/[0.03]"
            >
              {/* Large headshot */}
              <div className="relative w-full pt-2">
                <div className="mx-auto w-16 sm:w-20">
                  <PlayerAvatar name={player.player_name} playerId={player.player_id} sport={player.sport} size={80} />
                </div>
                {/* Rank badge — top left */}
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-black text-amber-400">
                  {i + 1}
                </span>
              </div>

              {/* Info below headshot */}
              <div className="flex w-full flex-col items-center gap-0.5 px-2 pb-2.5 pt-1">
                <span className="max-w-full truncate text-center text-[11px] font-semibold leading-tight">
                  {player.player_name.split(" ").slice(-1)[0]}
                </span>
                <span className="text-lg font-black tabular-nums leading-tight" style={{ color }}>
                  {pct}%
                </span>
                <div className="flex items-center gap-1">
                  <SportBadge sport={player.sport} />
                  <span className="text-[9px] tabular-nums text-muted-foreground">
                    {player.hits}/{player.total}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest — compact rows */}
      {rest.length > 0 && (
        <div className="flex flex-col">
          {rest.map((player, i) => {
            const pct = Math.round(player.rate * 100);
            const color = rateColor(pct);

            return (
              <div
                key={player.player_name}
                className="flex items-center gap-2 border-t border-white/5 py-1.5"
              >
                <span className="w-4 shrink-0 text-right text-[10px] text-muted-foreground/40">
                  {i + 4}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{player.player_name}</span>
                <SportBadge sport={player.sport} />
                <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{player.hits}/{player.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
