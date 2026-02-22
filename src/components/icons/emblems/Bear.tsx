import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Bear emblem — bold bear face with round ears, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Bear = memo(function Bear({ color }: EmblemProps) {
  return (
    <g fill={color} transform="translate(0,4)">
      {/* Left ear */}
      <circle cx="21" cy="18" r="5" />
      {/* Right ear */}
      <circle cx="43" cy="18" r="5" />
      {/* Head */}
      <ellipse cx="32" cy="30" rx="14" ry="13" />
      {/* Snout area */}
      <ellipse cx="32" cy="34" rx="6" ry="5" opacity="0.85" />
      {/* Eyes */}
      <circle cx="26" cy="27" r="2" />
      <circle cx="38" cy="27" r="2" />
      {/* Nose */}
      <path
        d="M30 33 L32 35 L34 33"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
});

export default Bear;
