import { memo } from "react";

interface EmblemProps {
  color: string;
}

/**
 * Baseball emblem — ball with curved stitching, recognizable at 12px.
 * Centered in 64x64 viewBox, fits within ~36x36 center area.
 */
const Baseball = memo(function Baseball({ color }: EmblemProps) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      {/* Ball outline */}
      <circle cx="32" cy="32" r="14" />
      {/* Left stitch curve */}
      <path d="M24 20 Q20 28 24 36 Q28 44 24 48" strokeWidth="1.5" />
      {/* Right stitch curve */}
      <path d="M40 16 Q44 24 40 32 Q36 40 40 44" strokeWidth="1.5" />
    </g>
  );
});

export default Baseball;
