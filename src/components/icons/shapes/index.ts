import type { ComponentType, ReactNode } from "react";
import type { IconShape } from "@/lib/icons/types";

import Circle from "./Circle";
import Shield from "./Shield";
import Hexagon from "./Hexagon";
import Diamond from "./Diamond";
import Square from "./Square";

export interface ShapeProps {
  bgColor: string;
  borderColor: string;
  children?: ReactNode;
}

/** Map of shape ID to its React component */
export const SHAPE_COMPONENTS: Record<IconShape, ComponentType<ShapeProps>> = {
  circle: Circle,
  shield: Shield,
  hexagon: Hexagon,
  diamond: Diamond,
  square: Square,
};

export { Circle, Shield, Hexagon, Diamond, Square };
