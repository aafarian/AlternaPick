import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Wolf emblem — howling wolf head silhouette, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Wolf = memo(function Wolf({ color }: EmblemProps) {
  return (
    <g fill={color} strokeLinejoin="round" transform="translate(0,3)">
      {/* Head + ears */}
      <path d="M22 22 L20 14 L26 20 L32 16 L38 20 L44 14 L42 22 L46 28 L44 36 L38 42 L32 44 L26 42 L20 36 L18 28 Z" />
      {/* Snout detail */}
      <path
        d="M28 32 L32 38 L36 32"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Eyes - cut out with contrasting dots */}
      <circle cx="27" cy="26" r="2" />
      <circle cx="37" cy="26" r="2" />
    </g>
  );
});

export default Wolf;
