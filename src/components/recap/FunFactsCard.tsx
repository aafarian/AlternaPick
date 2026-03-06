"use client";

import { useState, useCallback } from "react";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { Spotlight } from "@/lib/recaps/compute";
import {
  spotlightConfig,
  PLAYER_TYPES,
  SportBadge,
  sanitizeSpotlightText,
  type PlayerClickInfo,
} from "./tiles/shared";
import { PlayerPicksModal } from "@/components/recap/PlayerPicksModal";

interface SpotlightsCardProps {
  spotlights: Spotlight[];
}

export function SpotlightsCard({ spotlights }: SpotlightsCardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerClickInfo | null>(null);

  const handleSpotlightClick = useCallback((spotlight: Spotlight) => {
    if (PLAYER_TYPES.includes(spotlight.type) && spotlight.subject) {
      setSelectedPlayer({
        playerName: spotlight.subject,
        sport: spotlight.sport,
        statCategory: spotlight.statCategory,
      });
    }
  }, []);

  if (spotlights.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {spotlights.map((spotlight) => {
          const cfg = spotlightConfig[spotlight.type];
          const Icon = cfg.icon;
          const hasPlayer =
            PLAYER_TYPES.includes(spotlight.type) && spotlight.subject;
          const isClickable = hasPlayer;

          const Wrapper = isClickable ? "button" : "div";
          const wrapperProps = isClickable
            ? { type: "button" as const, onClick: () => handleSpotlightClick(spotlight) }
            : {};

          return (
            <Wrapper
              key={`${spotlight.type}-${spotlight.subject ?? ""}-${spotlight.value}`}
              {...wrapperProps}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col justify-between min-h-[140px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isClickable ? "cursor-pointer text-left" : ""}`}
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
                  {sanitizeSpotlightText(spotlight.headline)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {sanitizeSpotlightText(spotlight.detail)}
                </p>
                {spotlight.team && (
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
                    {spotlight.team}
                  </p>
                )}
              </div>
            </Wrapper>
          );
        })}
      </div>

      <PlayerPicksModal
        playerName={selectedPlayer?.playerName ?? null}
        sport={selectedPlayer?.sport}
        statCategory={selectedPlayer?.statCategory}
        onClose={() => setSelectedPlayer(null)}
      />
    </>
  );
}
