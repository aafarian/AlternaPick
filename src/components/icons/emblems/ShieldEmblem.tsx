import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Shield emblem — heraldic shield with chevron detail, recognizable at 12px.
 * Named ShieldEmblem to avoid collision with the Shield background shape.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const ShieldEmblem = memo(function ShieldEmblem({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round">
      {/* Shield outline */}
      <path
        d="M32 14 L46 20 L46 32 Q46 44 32 50 Q18 44 18 32 L18 20 Z"
        fill={color}
      />
      {/* Inner chevron detail */}
      <path d="M24 30 L32 22 L40 30" strokeWidth="3" opacity="0.3" />
      {/* Horizontal bar */}
      <line x1="22" y1="34" x2="42" y2="34" strokeWidth="2" opacity="0.3" />
    </g>
  );
});

export default ShieldEmblem;
