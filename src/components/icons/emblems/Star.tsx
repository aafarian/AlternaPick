import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Star emblem — classic 5-pointed star, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Star = memo(function Star({ color }: EmblemProps) {
  return (
    <g fill={color}>
      <polygon points="32,14 36.5,26 49,26 39,34 42.5,46 32,38 21.5,46 25,34 15,26 27.5,26" />
    </g>
  );
});

export default Star;
