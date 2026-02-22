import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Lightning emblem — bold lightning bolt, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Lightning = memo(function Lightning({ color }: EmblemProps) {
  return (
    <g fill={color}>
      <polygon points="36,14 22,34 30,34 26,50 42,28 34,28 38,14" />
    </g>
  );
});

export default Lightning;
