import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Crown emblem — royal crown with three points, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Crown = memo(function Crown({ color }: EmblemProps) {
  return (
    <g fill={color}>
      {/* Crown body with 3 peaks */}
      <path d="M18 40 L18 24 L26 32 L32 18 L38 32 L46 24 L46 40 Z" />
      {/* Base band */}
      <rect x="18" y="40" width="28" height="4" rx="1" />
      {/* Jewel dots on peaks */}
      <circle cx="18" cy="23" r="2" />
      <circle cx="32" cy="16" r="2" />
      <circle cx="46" cy="23" r="2" />
    </g>
  );
});

export default Crown;
