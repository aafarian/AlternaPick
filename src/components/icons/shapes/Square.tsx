import { memo } from "react";

import type { ShapeProps } from "./types";

/**
 * Rounded square centered in a 64x64 coordinate system.
 * 8px corner radius for a modern look.
 */
const Square = memo(function Square({ bgColor, borderColor, children }: ShapeProps) {
  return (
    <g>
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="8"
        fill={bgColor}
        stroke={borderColor}
        strokeWidth="2.5"
      />
      {children}
    </g>
  );
});

export default Square;
