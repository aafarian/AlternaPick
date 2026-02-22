import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Sword emblem — vertical blade with crossguard, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Sword = memo(function Sword({ color }: EmblemProps) {
  return (
    <g fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round">
      {/* Blade */}
      <path d="M30 14 L32 12 L34 14 L34 36 L30 36 Z" />
      {/* Blade tip */}
      <path d="M30 14 L32 10 L34 14" />
      {/* Crossguard */}
      <rect x="22" y="36" width="20" height="4" rx="2" />
      {/* Grip */}
      <rect x="30" y="40" width="4" height="8" rx="1" />
      {/* Pommel */}
      <circle cx="32" cy="50" r="3" />
    </g>
  );
});

export default Sword;
