import { memo } from "react";

import type { EmblemProps } from "./types";

/** Gem emblem — faceted diamond/gem, centered in 64x64 viewBox. */
const Gem = memo(function Gem({ color }: EmblemProps) {
  return (
    <g fill={color} strokeLinejoin="round">
      {/* Top facets */}
      <polygon points="32,14 20,26 44,26" />
      {/* Crown band */}
      <polygon points="20,26 44,26 32,26" opacity="0.8" />
      {/* Bottom facet */}
      <polygon points="20,26 32,50 44,26" opacity="0.85" />
      {/* Left facet line */}
      <polygon points="20,26 28,26 32,50" opacity="0.7" />
      {/* Right facet line */}
      <polygon points="36,26 44,26 32,50" opacity="0.7" />
      {/* Top left facet */}
      <polygon points="32,14 20,26 26,26" opacity="0.75" />
      {/* Top right facet */}
      <polygon points="32,14 38,26 44,26" opacity="0.75" />
    </g>
  );
});

export default Gem;
