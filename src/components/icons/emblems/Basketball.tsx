import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Basketball emblem — ball with seam lines, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Basketball = memo(function Basketball({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      {/* Ball outline */}
      <circle cx="32" cy="32" r="14" />
      {/* Vertical seam */}
      <path d="M32 18 L32 46" />
      {/* Horizontal seam */}
      <path d="M18 32 L46 32" />
      {/* Left curve seam */}
      <path d="M24 19 Q20 32 24 45" />
      {/* Right curve seam */}
      <path d="M40 19 Q44 32 40 45" />
    </g>
  );
});

export default Basketball;
