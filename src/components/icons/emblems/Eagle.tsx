import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Eagle emblem — spread wings silhouette, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Eagle = memo(function Eagle({ color }: EmblemProps) {
  return (
    <g fill={color} strokeLinejoin="round">
      {/* Spread wings */}
      <path d="M32 20 L14 24 L16 28 L12 30 L18 32 L14 35 L24 34 L28 38 L32 34 L36 38 L40 34 L50 35 L46 32 L52 30 L48 28 L50 24 Z" />
      {/* Head */}
      <circle cx="32" cy="18" r="4" />
      {/* Beak */}
      <path d="M32 21 L30 24 L32 26 L34 24 Z" />
      {/* Tail feathers */}
      <path d="M28 38 L26 44 L32 42 L38 44 L36 38" />
    </g>
  );
});

export default Eagle;
