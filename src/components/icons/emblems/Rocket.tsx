import { memo } from "react";

import type { EmblemProps } from "./types";

/** Rocket emblem — upward-facing rocket, centered in 64x64 viewBox. */
const Rocket = memo(function Rocket({ color }: EmblemProps) {
  return (
    <g fill={color}>
      {/* Body + nose cone */}
      <path d="M32 12 Q26 22 26 36 L38 36 Q38 22 32 12 Z" />
      {/* Left fin */}
      <path d="M26 32 L18 42 L26 40 Z" />
      {/* Right fin */}
      <path d="M38 32 L46 42 L38 40 Z" />
      {/* Exhaust base */}
      <path d="M26 36 L24 44 L28 40 L32 46 L36 40 L40 44 L38 36 Z" opacity="0.7" />
      {/* Window */}
      <circle cx="32" cy="24" r="3" opacity="0.5" />
    </g>
  );
});

export default Rocket;
