import { memo } from "react";

import type { ShapeProps } from "./types";

/**
 * Regular hexagon centered at 32,32 in a 64x64 coordinate system.
 * Flat-top orientation with radius ~28.
 */
const Hexagon = memo(function Hexagon({ bgColor, borderColor, children }: ShapeProps) {
  // Regular hexagon points (flat-top): r=28, center=32,32
  const points = "60,32 46,56.2 18,56.2 4,32 18,7.8 46,7.8";

  return (
    <g>
      <polygon
        points={points}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {children}
    </g>
  );
});

export default Hexagon;
