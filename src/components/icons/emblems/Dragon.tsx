import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Dragon emblem — stylized dragon head with horns, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Dragon = memo(function Dragon({ color }: EmblemProps) {
  return (
    <g fill={color} strokeLinejoin="round" transform="translate(0,7)">
      {/* Head */}
      <path d="M32 18 L24 16 L20 20 L18 28 L22 34 L28 38 L36 38 L42 34 L46 28 L44 20 L40 16 Z" />
      {/* Left horn */}
      <path d="M24 16 L18 10 L22 18" />
      {/* Right horn */}
      <path d="M40 16 L46 10 L42 18" />
      {/* Jaw / lower snout */}
      <path d="M24 34 L20 40 L28 38 M40 34 L44 40 L36 38" />
      {/* Nostrils */}
      <circle cx="28" cy="30" r="1.5" />
      <circle cx="36" cy="30" r="1.5" />
      {/* Eyes */}
      <path d="M25 24 L29 23 L25 22 Z" />
      <path d="M39 24 L35 23 L39 22 Z" />
      {/* Spine ridge */}
      <path d="M28 14 L30 11 L32 14 L34 11 L36 14" fill="none" stroke={color} strokeWidth="1.5" />
    </g>
  );
});

export default Dragon;
