import { memo } from "react";

import type { EmblemProps } from "./types";

/** Paw emblem — paw print with pad and toes, centered in 64x64 viewBox. */
const Paw = memo(function Paw({ color }: EmblemProps) {
  return (
    <g fill={color}>
      {/* Main pad */}
      <ellipse cx="32" cy="38" rx="10" ry="8" />
      {/* Toe 1 — top left */}
      <ellipse cx="21" cy="24" rx="5" ry="6" />
      {/* Toe 2 — inner left */}
      <ellipse cx="28" cy="20" rx="4.5" ry="5.5" />
      {/* Toe 3 — inner right */}
      <ellipse cx="36" cy="20" rx="4.5" ry="5.5" />
      {/* Toe 4 — top right */}
      <ellipse cx="43" cy="24" rx="5" ry="6" />
    </g>
  );
});

export default Paw;
