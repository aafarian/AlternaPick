"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  colors: readonly string[];
  selected: string;
  onSelect: (color: string) => void;
  label: string;
}

/**
 * Reusable color swatch grid picker.
 *
 * Used for background, border, and emblem color selections in the icon builder.
 * Renders a labeled grid of circular color swatches with a check icon on the
 * selected swatch. The check icon uses a text shadow to remain visible against
 * both light and dark swatch colors.
 */
export function ColorPicker({
  colors,
  selected,
  onSelect,
  label,
}: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>

      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-2"
      >
        {colors.map((color) => {
          const isSelected = color === selected;

          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={color}
              onClick={() => onSelect(color)}
              className={cn(
                "relative h-7 w-7 shrink-0 rounded-full border transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent"
                  : "border-border hover:scale-110"
              )}
              style={{ backgroundColor: color }}
            >
              {isSelected && (
                <Check
                  className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]"
                  strokeWidth={3}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
