import React, { memo } from "react";

import type { IconConfig } from "@/lib/icons/types";
import { SHAPE_COMPONENTS } from "@/components/icons/shapes";
import { EMBLEM_COMPONENTS } from "@/components/icons/emblems";

interface UserIconProps {
  config: IconConfig;
  size: number;
  className?: string;
}

/**
 * Renders a complete user icon as inline SVG.
 *
 * Composes a background shape with an emblem centered on top.
 * Uses a fixed 64x64 viewBox scaled to the requested pixel size
 * so icons look crisp at any dimension (24-64px).
 */
const UserIcon = memo(function UserIcon({ config, size, className }: UserIconProps) {
  const Shape = SHAPE_COMPONENTS[config.shape] ?? SHAPE_COMPONENTS.circle;
  const Emblem = EMBLEM_COMPONENTS[config.emblemId] ?? EMBLEM_COMPONENTS.star;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <Shape bgColor={config.bgColor} borderColor={config.borderColor}>
        <Emblem color={config.emblemColor} />
      </Shape>
    </svg>
  );
});

UserIcon.displayName = "UserIcon";

export default UserIcon;
export type { UserIconProps };
