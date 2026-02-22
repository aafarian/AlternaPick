import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Soccer emblem — ball with pentagon pattern, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Soccer = memo(function Soccer({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round">
      {/* Ball outline */}
      <circle cx="32" cy="32" r="14" strokeWidth="2.5" />
      {/* Center pentagon */}
      <polygon points="32,25 37,28 36,34 28,34 27,28" fill={color} />
      {/* Lines from pentagon to edge */}
      <line x1="32" y1="25" x2="32" y2="18" strokeWidth="1.5" />
      <line x1="37" y1="28" x2="44" y2="24" strokeWidth="1.5" />
      <line x1="36" y1="34" x2="42" y2="40" strokeWidth="1.5" />
      <line x1="28" y1="34" x2="22" y2="40" strokeWidth="1.5" />
      <line x1="27" y1="28" x2="20" y2="24" strokeWidth="1.5" />
    </g>
  );
});

export default Soccer;
