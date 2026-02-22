import { memo } from "react";

import type { EmblemProps } from "./types";

/**
 * Flame emblem — stylized fire, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Flame = memo(function Flame({ color }: EmblemProps) {
  return (
    <g fill={color}>
      {/* Main flame */}
      <path d="M32 14 Q38 22 40 28 Q44 36 40 42 Q38 46 32 48 Q26 46 24 42 Q20 36 24 28 Q26 22 32 14 Z" />
      {/* Inner flame flicker */}
      <path d="M32 24 Q36 30 34 36 Q33 40 32 42 Q31 40 30 36 Q28 30 32 24 Z" opacity="0.3" />
    </g>
  );
});

export default Flame;
