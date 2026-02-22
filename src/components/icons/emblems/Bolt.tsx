import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Bolt emblem — circular energy bolt with radiating lines, recognizable at 12px.
 * Distinct from Lightning — this shows a radiant energy burst.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Bolt = memo(function Bolt({ color }: EmblemProps) {
  return (
    <g fill={color} stroke={color} strokeWidth="2.5" strokeLinecap="round">
      {/* Center circle */}
      <circle cx="32" cy="32" r="5" />
      {/* Radiating bolt lines */}
      <line x1="32" y1="14" x2="32" y2="22" />
      <line x1="32" y1="42" x2="32" y2="50" />
      <line x1="14" y1="32" x2="22" y2="32" />
      <line x1="42" y1="32" x2="50" y2="32" />
      {/* Diagonal rays */}
      <line x1="20" y1="20" x2="25" y2="25" />
      <line x1="39" y1="39" x2="44" y2="44" />
      <line x1="44" y1="20" x2="39" y2="25" />
      <line x1="20" y1="44" x2="25" y2="39" />
    </g>
  );
});

export default Bolt;
