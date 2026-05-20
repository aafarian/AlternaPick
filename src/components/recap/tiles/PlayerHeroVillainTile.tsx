import { AlertTriangle, Check } from "lucide-react";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import type { PlayerSpotlight } from "@/lib/recaps/compute";
import { TILE, TileHeader, TilePill, type OnPlayerClick } from "./shared";

export function PlayerHeroVillainTile({
  good,
  bad,
  platformHitRate,
  onPlayerClick,
}: {
  good: PlayerSpotlight[];
  bad: PlayerSpotlight[];
  platformHitRate: number;
  onPlayerClick?: OnPlayerClick;
}) {
  const topGood = good[0] ?? null;
  const topBad = bad[0] ?? null;

  const goodDelta = topGood ? topGood.hitRate - platformHitRate : 0;
  const badDelta = topBad ? platformHitRate - topBad.hitRate : 0;

  let pick: PlayerSpotlight | null = null;
  let isHero = true;
  if (goodDelta >= badDelta && goodDelta >= 0.15) {
    pick = topGood;
    isHero = true;
  } else if (badDelta > goodDelta && badDelta >= 0.15) {
    pick = topBad;
    isHero = false;
  }

  if (!pick) return null;

  const tileBorder = isHero
    ? "border-neon-green/20 bg-neon-green/5"
    : "border-bold-red/20 bg-bold-red/5";
  const textColor = isHero ? "text-neon-green" : "text-bold-red";
  const pillBg = isHero ? "bg-neon-green/10" : "bg-bold-red/10";

  const handleClick = () => {
    onPlayerClick?.({ playerName: pick.playerName, sport: pick.sport });
  };

  return (
    <button
      type="button"
      className={`${TILE} ${tileBorder} cursor-pointer text-left`}
      onClick={handleClick}
    >
      <TileHeader
        icon={isHero ? Check : AlertTriangle}
        label={`${isHero ? "Hero" : "Villain"} of the Day`}
        textColor={textColor}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {isHero ? "Best" : "Worst"} player prop performance
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <TilePill
          bgColor={pillBg}
          left={
            <div className="flex items-center gap-2">
              <PlayerAvatar
                playerId={pick.playerId}
                playerName={pick.playerName}
                sport={pick.sport}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {pick.playerName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {pick.pickCount} picks
                </p>
              </div>
            </div>
          }
          right={`${Math.round(pick.hitRate * 100)}%`}
          rightColor={textColor}
        />
      </div>
    </button>
  );
}
