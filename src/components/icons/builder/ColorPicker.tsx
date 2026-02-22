"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  colors: readonly string[];
  selected: string;
  onSelect: (color: string) => void;
  label: string;
  /** When true, the picker content is collapsible on mobile (< 640px). */
  collapsible?: boolean;
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
  collapsible = false,
}: ColorPickerProps) {
  const swatchGrid = (
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
              "relative h-7 w-7 shrink-0 rounded-full border transition-all duration-150",
              "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-7 sm:w-7",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent scale-110"
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
  );

  if (collapsible) {
    return (
      <details className="group sm:open space-y-2" open>
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground sm:pointer-events-none [&::-webkit-details-marker]:hidden">
          <svg
            className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-90 sm:hidden"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {label}
        </summary>
        <div className="pt-1">
          {swatchGrid}
        </div>
      </details>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {swatchGrid}
    </div>
  );
}
