import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Hawk emblem — diving bird of prey silhouette, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Hawk = memo(function Hawk({ color }: EmblemProps) {
  return (
    <g fill={color} strokeLinejoin="round">
      {/* Body and swept-back wings in dive pose */}
      <path d="M32 16 L28 20 L14 22 L18 26 L12 30 L22 30 L26 36 L30 32 L32 44 L34 32 L38 36 L42 30 L52 30 L46 26 L50 22 L36 20 Z" />
      {/* Eye */}
      <circle cx="32" cy="20" r="1.5" />
      {/* Beak */}
      <path d="M31 22 L32 26 L33 22" />
    </g>
  );
});

export default Hawk;
