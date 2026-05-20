import { BarChart3 } from "lucide-react";
import { TILE_STATIC, TileHeader, TilePill } from "./shared";

export function PropDifficultyTile({
  lockCount,
  trapCount,
}: {
  lockCount: number;
  trapCount: number;
}) {
  const total = lockCount + trapCount;
  if (total < 2) return null;

  const isEasy = lockCount > trapCount;
  const isEqual = lockCount === trapCount;
  const tileBorder = isEqual
    ? "border-amber-500/20 bg-amber-500/5"
    : isEasy
      ? "border-neon-green/20 bg-neon-green/5"
      : "border-bold-red/20 bg-bold-red/5";
  const textColor = isEqual
    ? "text-amber-400"
    : isEasy
      ? "text-neon-green"
      : "text-bold-red";
  const pillBg = isEqual
    ? "bg-amber-500/10"
    : isEasy
      ? "bg-neon-green/10"
      : "bg-bold-red/10";
  const headline = isEqual
    ? "Mixed slate"
    : isEasy
      ? "Easy slate"
      : "Tough slate";

  return (
    <div className={`${TILE_STATIC} ${tileBorder}`}>
      <TileHeader icon={BarChart3} label={headline} textColor={textColor} />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {isEasy
          ? "More locks than traps today"
          : isEqual
            ? "Equal locks and traps today"
            : "More traps than locks today"}
      </p>
      <div className="mt-2 flex flex-col gap-2 flex-1">
        <TilePill
          bgColor={pillBg}
          left={`${lockCount} ${lockCount === 1 ? "lock" : "locks"} · ${trapCount} ${trapCount === 1 ? "trap" : "traps"}`}
          right={`${lockCount}:${trapCount}`}
          rightColor={textColor}
        />
      </div>
    </div>
  );
}
