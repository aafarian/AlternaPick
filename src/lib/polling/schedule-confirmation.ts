import type { MutableRefObject } from "react";

const CONFIRMATION_DELAY_MS = 5000;

interface PollingConfirmationOptions {
  url: string;
  intervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  confirmTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  confirmAbortRef: MutableRefObject<AbortController | null>;
  stoppedRef: MutableRefObject<boolean>;
  /** Parse the JSON response and return whether all games are still final. */
  isStillAllFinal: (json: unknown) => boolean;
  /** Apply the confirmed data to component state before stopping. */
  onConfirmed: (json: unknown) => void;
  stopPolling: () => void;
  resumePolling: () => void;
}

/**
 * Shared confirmation-fetch pattern used by all live polling hooks.
 *
 * After the primary fetch reports all games final, this schedules a delayed
 * re-fetch to guard against transient false positives. If the confirmation
 * agrees, polling stops. Otherwise (or on error), polling resumes.
 */
export function schedulePollingConfirmation(opts: PollingConfirmationOptions) {
  clearInterval(opts.intervalRef.current!);
  opts.intervalRef.current = null;

  if (opts.confirmTimeoutRef.current) clearTimeout(opts.confirmTimeoutRef.current);
  opts.confirmAbortRef.current?.abort();

  opts.confirmTimeoutRef.current = setTimeout(async () => {
    opts.confirmTimeoutRef.current = null;
    if (opts.stoppedRef.current) return;

    const controller = new AbortController();
    opts.confirmAbortRef.current = controller;

    try {
      const res = await fetch(opts.url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      if (opts.stoppedRef.current) return;

      if (opts.isStillAllFinal(json)) {
        opts.onConfirmed(json);
        opts.stopPolling();
      } else {
        opts.resumePolling();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!opts.stoppedRef.current) {
        opts.resumePolling();
      }
    }
  }, CONFIRMATION_DELAY_MS);
}
