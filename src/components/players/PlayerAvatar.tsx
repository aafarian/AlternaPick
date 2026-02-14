"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getPlayerHeadshotUrl } from "@/lib/constants";

interface PlayerAvatarProps {
  playerId: string | null;
  playerName: string;
  sport?: string;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}

const SIZE_PX = { sm: 24, default: 32, lg: 40, xl: 56 } as const;
const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[8px]",
  default: "h-8 w-8 text-[10px]",
  lg: "h-10 w-10 text-xs",
  xl: "h-14 w-14 text-sm",
} as const;

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function PlayerAvatar({
  playerId,
  playerName,
  sport,
  size = "default",
  className,
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const px = SIZE_PX[size];

  if (!playerId || imgError) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary",
          SIZE_CLASSES[size],
          className
        )}
      >
        {getInitials(playerName)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-secondary",
        SIZE_CLASSES[size],
        className
      )}
    >
      <Image
        src={getPlayerHeadshotUrl(playerId, sport)}
        alt={playerName}
        width={px}
        height={px}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
