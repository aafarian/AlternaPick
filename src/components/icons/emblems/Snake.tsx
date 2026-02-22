import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Snake emblem — coiled serpent with raised head, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Snake = memo(function Snake({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {/* Coiled body */}
      <path d="M38 42 Q46 42 46 36 Q46 30 38 30 Q26 30 26 36 Q26 42 34 42" />
      {/* Rising neck and head */}
      <path d="M38 30 Q38 22 34 18 Q32 16 30 16" />
      {/* Head (filled) */}
      <ellipse cx="28" cy="16" rx="4" ry="3" fill={color} />
      {/* Tongue */}
      <path d="M24 16 L20 14 M24 16 L20 18" strokeWidth="1.5" />
      {/* Eye */}
      <circle cx="27" cy="15" r="0.8" fill={color} />
    </g>
  );
});

export default Snake;
