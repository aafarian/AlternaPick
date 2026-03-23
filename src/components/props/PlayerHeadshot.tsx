"use client";

import { useState } from "react";
import Image from "next/image";
import { getPlayerHeadshotUrl, getHeadshotConfig } from "@/lib/sports";
import { getInitials } from "@/lib/format/name-utils";
import { cn } from "@/lib/utils";

interface PlayerHeadshotProps {
  playerId: string | null;
  playerName: string;
  sport?: string;
  /** When true, uses smaller sizes on mobile with sm: breakpoint scaling */
  responsive?: boolean;
}

export default function PlayerHeadshot({
  playerId,
  playerName,
  sport,
  responsive = false,
}: PlayerHeadshotProps) {
  const [imgError, setImgError] = useState(false);

  if (!playerId || imgError) {
    return (
      <div
        className={cn(
          "flex items-end justify-center",
          responsive
            ? "h-[72px] w-[100px] sm:h-[100px] sm:w-[130px]"
            : "h-[100px] w-[130px]"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary",
            responsive
              ? "h-12 w-12 text-sm sm:h-16 sm:w-16 sm:text-lg"
              : "h-16 w-16 text-lg"
          )}
        >
          {getInitials(playerName)}
        </div>
      </div>
    );
  }

  const hs = getHeadshotConfig(sport);

  return (
    <div
      className={cn(
        "relative",
        responsive
          ? "h-[72px] w-[100px] sm:h-[100px] sm:w-[130px]"
          : "h-[100px] w-[130px]"
      )}
    >
      <Image
        src={getPlayerHeadshotUrl(playerId, sport)}
        alt={playerName}
        width={hs.width}
        height={hs.height}
        unoptimized={hs.isProxied}
        className={cn(
          "relative z-10 object-contain drop-shadow-lg",
          hs.isProxied ? "mx-auto object-bottom" : "object-bottom"
        )}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
