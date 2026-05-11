"use client";

import type { PlayerStats } from "@/lib/analytics/types";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { SPORT_LABELS, isValidSport, getPlayerHeadshotUrl } from "@/lib/sports";
import { usePlayerProfile } from "@/lib/players/player-profile-context";

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
  const { openProfile } = usePlayerProfile();

  if (data.length === 0) return null;

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  function handleClick(player: PlayerStats) {
    if (!player.player_id) return;
    openProfile({
      playerId: player.player_id,
      playerName: player.player_name,
      playerTeam: null,
      playerPosition: null,
      sport: player.sport,
    });
  }

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Top Players</h2>

      {/* Podium — top 3 */}
      <div className="mb-4 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {top3.map((player, i) => {
          const pct = Math.round(player.rate * 100);
          const color = rateColor(pct);
          const medalColors = [
            "text-amber-400",    // gold
            "text-gray-400",     // silver
            "text-amber-600",    // bronze
          ];

          return (
            <div
              key={player.player_name}
              className="relative flex w-28 shrink-0 flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-2 pb-3 pt-2.5 sm:w-auto sm:px-3 sm:pb-4 sm:pt-3"
            >
              {/* Rank — top left, clean number */}
              <span className={`absolute left-3 top-3 text-sm font-black ${medalColors[i]}`}>
                {i + 1}
              </span>

              {/* Headshot — hero (clickable) */}
              <button
                type="button"
                onClick={() => handleClick(player)}
                className="mb-2.5 mt-1 cursor-pointer transition-transform hover:scale-105"
                disabled={!player.player_id}
              >
                <PlayerAvatar name={player.player_name} playerId={player.player_id} sport={player.sport} size={56} />
              </button>

              {/* Name — first initial + last name to fit */}
              <p className="mb-1 max-w-full truncate text-center text-[11px] font-bold leading-tight">
                {(() => {
                  const parts = player.player_name.split(" ");
                  if (parts.length < 2) return player.player_name;
                  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
                })()}
              </p>

              {/* Hit rate — prominent */}
              <p className="text-base font-black tabular-nums leading-none sm:text-xl" style={{ color }}>
                {pct}%
              </p>

              {/* Sport + count footer */}
              <div className="mt-1.5 flex items-center gap-1">
                <SportBadge sport={player.sport} />
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {player.hits}/{player.total}
                </span>
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
                <span className="hidden sm:inline"><SportBadge sport={player.sport} /></span>
                <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
                <span className="hidden shrink-0 text-[10px] tabular-nums text-muted-foreground sm:inline">{player.hits}/{player.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
