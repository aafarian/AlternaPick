import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Trophy emblem — classic cup with handles, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Trophy = memo(function Trophy({ color }: EmblemProps) {
  return (
    <g fill={color} strokeLinejoin="round">
      {/* Cup body */}
      <path d="M24 18 L24 30 Q24 38 32 40 Q40 38 40 30 L40 18 Z" />
      {/* Left handle */}
      <path
        d="M24 20 Q16 20 16 28 Q16 32 24 32"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Right handle */}
      <path
        d="M40 20 Q48 20 48 28 Q48 32 40 32"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Stem */}
      <rect x="30" y="40" width="4" height="4" />
      {/* Base */}
      <rect x="25" y="44" width="14" height="3" rx="1" />
    </g>
  );
});

export default Trophy;
