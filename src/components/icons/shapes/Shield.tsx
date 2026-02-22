import { memo } from "react";

import type { ShapeProps } from "./types";

/**
 * A crest/shield shape centered at 32,32 in a 64x64 coordinate system.
 * Wide shoulders tapering to a point at the bottom.
 */
const Shield = memo(function Shield({ bgColor, borderColor, children }: ShapeProps) {
  return (
    <g>
      <path
        d="M32 3 L56 12 L56 30 Q56 48 32 61 Q8 48 8 30 L8 12 Z"
        fill={bgColor}
        stroke={borderColor}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {children}
    </g>
  );
});

export default Shield;
