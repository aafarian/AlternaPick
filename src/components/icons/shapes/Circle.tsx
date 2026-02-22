import { memo } from "react";

import type { ShapeProps } from "./types";

const Circle = memo(function Circle({ bgColor, borderColor, children }: ShapeProps) {
  return (
    <g>
      <circle cx="32" cy="32" r="29" fill={bgColor} stroke={borderColor} strokeWidth="2.5" />
      {children}
    </g>
  );
});

export default Circle;
