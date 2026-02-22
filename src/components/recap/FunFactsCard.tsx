"use client";

import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { Spotlight } from "@/lib/recaps/compute";
import {
  spotlightConfig,
  PLAYER_TYPES,
  SportBadge,
} from "./tiles/shared";

interface SpotlightsCardProps {
  spotlights: Spotlight[];
}

export function SpotlightsCard({ spotlights }: SpotlightsCardProps) {
  if (spotlights.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {spotlights.map((spotlight) => {
        const cfg = spotlightConfig[spotlight.type];
        const Icon = cfg.icon;
        const hasPlayer =
          PLAYER_TYPES.includes(spotlight.type) && spotlight.subject;

        return (
          <div
            key={`${spotlight.type}-${spotlight.subject ?? ""}-${spotlight.value}`}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col justify-between min-h-[140px]`}
          >
            {/* Top row: icon/avatar + value */}
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-1.5">
                {hasPlayer && spotlight.playerId ? (
                  <PlayerAvatar
                    playerId={spotlight.playerId}
                    playerName={spotlight.subject!}
                    sport={spotlight.sport}
                    size="sm"
                  />
                ) : (
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`} />
                )}
                {spotlight.sport && <SportBadge sport={spotlight.sport} />}
              </div>
              <span
                className={`text-xl font-black tabular-nums leading-none ${cfg.valueColor}`}
              >
                {spotlight.value}
                <span className="text-[10px] font-bold">
                  {spotlight.valueSuffix}
                </span>
              </span>
            </div>

            {/* Bottom: headline + detail + team */}
            <div className="mt-auto pt-2">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {spotlight.headline}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {spotlight.detail}
              </p>
              {spotlight.team && (
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
                  {spotlight.team}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
