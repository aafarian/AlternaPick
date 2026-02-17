"use client";

import * as React from "react";
import { motion, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AnimatedInputProps extends React.ComponentProps<"input"> {
  label?: string;
}

/**
 * Drop-in replacement for `<Input>` with smooth animated focus effects.
 *
 * Focus effects:
 *  - Border transitions to primary color with a subtle neon glow
 *  - Container scales up slightly (1.01x)
 *  - Optional floating label animates upward when focused or filled
 *
 * Respects `prefers-reduced-motion` -- instant state changes, no animation.
 */
const AnimatedInput = React.forwardRef<HTMLInputElement, AnimatedInputProps>(
  ({ className, type, label, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);
    const prefersReduced = useReducedMotion();
    const inputId = id || React.useId();

    // Track whether the input has a value (for floating label)
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setHasValue(e.target.value.length > 0);
        props.onChange?.(e);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.onChange],
    );

    // Check initial value / defaultValue
    React.useEffect(() => {
      if (props.value !== undefined && props.value !== "") {
        setHasValue(true);
      } else if (props.defaultValue !== undefined && props.defaultValue !== "") {
        setHasValue(true);
      }
    }, [props.value, props.defaultValue]);

    const isLabelFloated = isFocused || hasValue;

    const inputElement = (
      <input
        ref={ref}
        id={inputId}
        type={type}
        data-slot="input"
        className={cn(
          // Base styles (matching Input component)
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // Animated focus transition
          prefersReduced
            ? "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            : "transition-[border-color,box-shadow] duration-200 ease-out",
          // Aria-invalid styles
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          // Hide placeholder when label is present and not floated
          label && !isLabelFloated && "placeholder:text-transparent",
          className,
        )}
        style={
          !prefersReduced && isFocused
            ? {
                borderColor: "var(--color-primary)",
                boxShadow:
                  "0 0 12px rgba(0,210,106,0.15), 0 0 0 3px rgba(0,210,106,0.10)",
              }
            : undefined
        }
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        onChange={handleChange}
        {...props}
      />
    );

    // ---- Reduced-motion path: no animations, just instant state ----
    if (prefersReduced) {
      return (
        <div className={cn("relative", label && "pt-4")}>
          {label && (
            <label
              htmlFor={inputId}
              className={cn(
                "absolute left-3 top-[1.125rem] origin-top-left text-sm pointer-events-none",
                isLabelFloated
                  ? "-translate-y-6 scale-[0.85] text-primary opacity-100"
                  : "text-muted-foreground opacity-50",
              )}
            >
              {label}
            </label>
          )}
          {inputElement}
        </div>
      );
    }

    // ---- Standard path: animated ----
    return (
      <motion.div
        className={cn("relative", label && "pt-4")}
        initial={{ scale: 1 }}
        animate={{ scale: isFocused ? 1.01 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {label && (
          <motion.label
            htmlFor={inputId}
            className="text-muted-foreground absolute left-3 top-[1.125rem] origin-top-left text-sm pointer-events-none"
            initial={{ y: 0, scale: 1, opacity: 0.5 }}
            animate={
              isLabelFloated
                ? { y: -24, scale: 0.85, opacity: 1 }
                : { y: 0, scale: 1, opacity: 0.5 }
            }
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={isLabelFloated ? { color: "var(--color-primary)" } : undefined}
          >
            {label}
          </motion.label>
        )}
        {inputElement}
      </motion.div>
    );
  },
);

AnimatedInput.displayName = "AnimatedInput";

export { AnimatedInput };
export type { AnimatedInputProps };
