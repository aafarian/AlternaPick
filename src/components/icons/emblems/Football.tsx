import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Football emblem — American football with laces, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Football = memo(function Football({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Ball shape - pointed ellipse */}
      <ellipse cx="32" cy="32" rx="16" ry="10" fill={color} transform="rotate(-30 32 32)" />
      {/* Lace center line */}
      <line x1="28" y1="28" x2="36" y2="36" stroke={color} strokeWidth="2" opacity="0.3" />
      {/* Lace stitches */}
      <line x1="29" y1="30" x2="31" y2="28" stroke={color} strokeWidth="1.5" opacity="0.3" />
      <line x1="31" y1="32" x2="33" y2="30" stroke={color} strokeWidth="1.5" opacity="0.3" />
      <line x1="33" y1="34" x2="35" y2="32" stroke={color} strokeWidth="1.5" opacity="0.3" />
    </g>
  );
});

export default Football;
