import React, { memo } from "react";

interface ShapeProps {
  bgColor: string;
  borderColor: string;
  children?: React.ReactNode;
}

const Circle = memo(function Circle({ bgColor, borderColor, children }: ShapeProps) {
  return (
    <g>
      <circle cx="32" cy="32" r="29" fill={bgColor} stroke={borderColor} strokeWidth="2.5" />
      {children}
    </g>
  );
});

export default Circle;
