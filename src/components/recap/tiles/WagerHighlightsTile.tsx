"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { TILE, TileHeader, TilePill } from "./shared";
import type { WagerHighlights } from "@/lib/recaps/compute";

interface WagerHighlightsTileProps {
  data: WagerHighlights;
}

export default function WagerHighlightsTile({ data }: WagerHighlightsTileProps) {
  const { biggestPayout, topWagerer, totalWagered } = data;

  if (totalWagered === 0) return null;

  return (
    <div className={`${TILE} border-orange-500/20 bg-orange-500/5`}>
      <TileHeader
        icon={Flame}
        label="Flame Coin Highlights"
        textColor="text-orange-400"
      />

      <div className="flex flex-col gap-1.5">
        {biggestPayout && (
          <Link href={`/cards/${biggestPayout.cardId}`}>
            <TilePill
              bgColor="bg-orange-500/10"
              left={
                <span className="truncate text-xs">
                  <span className="font-bold text-foreground">@{biggestPayout.username}</span>
                  {" "}hit a {biggestPayout.multiplier}x
                </span>
              }
              right={
                <span className="text-xs font-bold tabular-nums">
                  +{biggestPayout.payout}
                </span>
              }
              rightColor="text-emerald-500"
            />
          </Link>
        )}

        {topWagerer && (
          <TilePill
            bgColor="bg-orange-500/10"
            left={
              <span className="truncate text-xs">
                <span className="font-bold text-foreground">@{topWagerer.username}</span>
                {" "}wagered {topWagerer.totalWagered} coins
              </span>
            }
            right={
              <span className="text-xs font-bold tabular-nums">
                {topWagerer.netResult >= 0 ? "+" : ""}{topWagerer.netResult}
              </span>
            }
            rightColor={topWagerer.netResult >= 0 ? "text-emerald-500" : "text-bold-red"}
          />
        )}

        <TilePill
          bgColor="bg-orange-500/10"
          left={<span className="text-xs text-muted-foreground">Total wagered this week</span>}
          right={<span className="text-xs font-bold tabular-nums">{totalWagered.toLocaleString()}</span>}
          rightColor="text-orange-400"
        />
      </div>
    </div>
  );
}
