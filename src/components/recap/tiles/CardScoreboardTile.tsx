import { Target } from "lucide-react";
import { TILE_STATIC, TileHeader, TilePill } from "./shared";

export function CardScoreboardTile({
  totalPicks,
  totalCards,
  platformHitRate,
}: {
  totalPicks: number;
  totalCards: number;
  platformHitRate: number;
}) {
  if (totalCards < 3) return null;
  const avgPicksPerCard = Math.round(totalPicks / totalCards);
  const avgHits =
    Math.round(avgPicksPerCard * platformHitRate * 10) / 10;

  return (
    <div className={`${TILE_STATIC} border-amber-500/20 bg-amber-500/5`}>
      <TileHeader
        icon={Target}
        label="Avg Card Score"
        textColor="text-amber-400"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Average hits per card across {totalCards} cards
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <TilePill
          bgColor="bg-amber-500/10"
          left={`${avgHits} hits out of ${avgPicksPerCard} picks`}
          right={`${avgHits}/${avgPicksPerCard}`}
          rightColor="text-amber-400"
        />
      </div>
    </div>
  );
}
