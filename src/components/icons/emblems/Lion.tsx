import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Lion emblem — bold mane silhouette, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Lion = memo(function Lion({ color }: EmblemProps) {
  return (
    <g fill={color} stroke={color} strokeWidth="0.5" strokeLinejoin="round" transform="translate(0,5)">
      {/* Mane - outer ring of spiky fur */}
      <path d="M32 14 L35 17 L39 13 L39 18 L44 16 L42 21 L47 21 L43 25 L48 27 L43 29 L47 33 L42 32 L44 37 L39 34 L39 39 L35 36 L32 40 L29 36 L25 39 L25 34 L20 37 L22 32 L17 33 L21 29 L16 27 L21 25 L17 21 L22 21 L20 16 L25 18 L25 13 L29 17 Z" />
      {/* Face - simple circle */}
      <circle cx="32" cy="27" r="8" />
      {/* Eyes */}
      <circle cx="28.5" cy="25.5" r="1.5" fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx="35.5" cy="25.5" r="1.5" fill="none" stroke={color} strokeWidth="1.5" />
      {/* Nose/snout */}
      <path d="M30 29 L32 31 L34 29" fill="none" strokeWidth="1.5" />
    </g>
  );
});

export default Lion;
