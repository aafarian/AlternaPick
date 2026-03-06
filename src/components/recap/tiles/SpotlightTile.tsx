import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { Spotlight } from "@/lib/recaps/compute";
import {
  TILE,
  PLAYER_TYPES,
  spotlightConfig,
  SportBadge,
  sanitizeSpotlightText,
  type OnPlayerClick,
} from "./shared";

export function SpotlightTile({
  spotlight,
  onPlayerClick,
}: {
  spotlight: Spotlight;
  onPlayerClick?: OnPlayerClick;
}) {
  const cfg = spotlightConfig[spotlight.type];
  const Icon = cfg.icon;
  const hasPlayer =
    PLAYER_TYPES.includes(spotlight.type) && spotlight.subject;

  // All player-type spotlights open the player modal (with optional stat filter)
  const isClickable = hasPlayer && spotlight.subject && onPlayerClick;

  const handleClick = () => {
    if (hasPlayer && spotlight.subject && onPlayerClick) {
      onPlayerClick({
        playerName: spotlight.subject,
        sport: spotlight.sport,
        statCategory: spotlight.statCategory,
      });
    }
  };

  const Wrapper = isClickable ? "button" : "div";
  const wrapperProps = isClickable
    ? { type: "button" as const, onClick: handleClick }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`${TILE} ${cfg.border} ${cfg.bg} ${isClickable ? "cursor-pointer text-left" : ""}`}
    >
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
          <span className="text-[10px] font-bold">{spotlight.valueSuffix}</span>
        </span>
      </div>
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
}
