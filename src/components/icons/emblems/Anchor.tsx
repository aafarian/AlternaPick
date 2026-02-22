import { memo } from "react";

import type { EmblemProps } from "./types";

/** Anchor emblem — classic anchor shape, centered in 64x64 viewBox. */
const Anchor = memo(function Anchor({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {/* Ring at top */}
      <circle cx="32" cy="17" r="4" />
      {/* Vertical shaft */}
      <line x1="32" y1="21" x2="32" y2="46" />
      {/* Crossbar */}
      <line x1="22" y1="30" x2="42" y2="30" />
      {/* Left fluke */}
      <path d="M18 42 Q18 46 22 48 Q26 46 32 46" />
      {/* Right fluke */}
      <path d="M46 42 Q46 46 42 48 Q38 46 32 46" />
    </g>
  );
});

export default Anchor;
