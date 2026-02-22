import { memo } from "react";

import type { EmblemProps } from "./types";

/** Mountain emblem — twin peaks, centered in 64x64 viewBox. */
const Mountain = memo(function Mountain({ color }: EmblemProps) {
  return (
    <g fill={color}>
      {/* Main peak */}
      <polygon points="32,14 48,48 16,48" />
      {/* Snow cap */}
      <polygon points="32,14 36,22 28,22" opacity="0.7" />
      {/* Secondary peak */}
      <polygon points="44,26 54,48 34,48" opacity="0.75" />
    </g>
  );
});

export default Mountain;
