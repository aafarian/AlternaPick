"use client";

import { memo } from "react";
import type { IconShape } from "@/lib/icons/types";
import { SHAPES } from "@/lib/icons/constants";
import { SHAPE_COMPONENTS } from "@/components/icons/shapes";

interface ShapePickerProps {
  selected: IconShape;
  bgColor: string;
  borderColor: string;
  onSelect: (shape: IconShape) => void;
}

/** Display label for each shape */
const SHAPE_LABELS: Record<IconShape, string> = {
  circle: "Circle",
  shield: "Shield",
  hexagon: "Hexagon",
  diamond: "Diamond",
  square: "Square",
};

/**
 * A visual grid picker for the 5 background shapes.
 * Each shape renders as a small clickable SVG preview with the current
 * bgColor/borderColor applied. The selected shape gets a highlight ring.
 */
const ShapePicker = memo(function ShapePicker({
  selected,
  bgColor,
  borderColor,
  onSelect,
}: ShapePickerProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">Shape</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Background shape">
        {SHAPES.map((shape) => {
          const ShapeComponent = SHAPE_COMPONENTS[shape];
          const isSelected = shape === selected;

          return (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={SHAPE_LABELS[shape]}
              className={`
                flex items-center justify-center rounded-lg p-1
                transition-all duration-150
                min-w-[44px] min-h-[44px]
                cursor-pointer
                bg-muted/50 hover:bg-muted
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
                ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "ring-1 ring-border"}
              `}
              onClick={() => onSelect(shape)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={36}
                height={36}
                viewBox="0 0 64 64"
                aria-hidden="true"
              >
                <ShapeComponent bgColor={bgColor} borderColor={borderColor} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ShapePicker.displayName = "ShapePicker";

export default ShapePicker;
export type { ShapePickerProps };
