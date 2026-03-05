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
  ({ className, type, label, id, onFocus, onBlur, onChange, ...restProps }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);
    const prefersReduced = useReducedMotion();
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const internalRef = React.useRef<HTMLInputElement | null>(null);

    // Merge forwarded ref with internal ref
    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    // Track whether the input has a value (for floating label)
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setHasValue(e.target.value.length > 0);
        onChange?.(e);
      },
      [onChange],
    );

    // Check initial value / defaultValue
    React.useEffect(() => {
      if (restProps.value !== undefined && restProps.value !== "") {
        setHasValue(true);
      } else if (restProps.defaultValue !== undefined && restProps.defaultValue !== "") {
        setHasValue(true);
      }
    }, [restProps.value, restProps.defaultValue]);

    // Detect browser autofill via the CSS animation trick.
    // Browsers fire animationstart with our "autofill-start" keyframe
    // when they autofill an input (e.g. saved passwords).
    const handleAnimationStart = React.useCallback(
      (e: React.AnimationEvent<HTMLInputElement>) => {
        if (e.animationName === "autofill-start") {
          setHasValue(true);
        }
      },
      [],
    );

    // Fallback: poll for :autofill pseudo-class after mount.
    // The animationstart event misses autofills that happen before React
    // hydrates (e.g. saved passwords injected on page load).
    React.useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      const check = () => {
        try {
          if (el.matches(":autofill") || el.matches(":-webkit-autofill")) {
            setHasValue(true);
          }
        } catch { /* pseudo-class not supported */ }
      };
      const timers = [60, 200, 1000].map((ms) => setTimeout(check, ms));
      return () => timers.forEach(clearTimeout);
    }, []);

    const isLabelFloated = isFocused || hasValue;

    const inputElement = (
      <input
        {...restProps}
        ref={setRefs}
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
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        onChange={handleChange}
        onAnimationStart={handleAnimationStart}
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
