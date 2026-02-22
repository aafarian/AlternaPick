import React, { memo } from "react";

interface ShapeProps {
  bgColor: string;
  borderColor: string;
  children?: React.ReactNode;
}

/**
 * Diamond (rotated square) centered at 32,32 in a 64x64 coordinate system.
 * Points at top, right, bottom, left.
 */
const Diamond = memo(function Diamond({ bgColor, borderColor, children }: ShapeProps) {
  const points = "32,3 61,32 32,61 3,32";

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

export default Diamond;
