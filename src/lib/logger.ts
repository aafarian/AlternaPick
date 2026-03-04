/**
 * Simple in-memory error logger with a ring buffer.
 * Errors are logged to console AND stored for the admin dashboard.
 * On long-lived processes (Hetzner), the buffer persists until restart.
 */

export interface LogEntry {
  message: string;
  category: string;
  timestamp: string;
  endpoint: string | null;
  stack?: string;
}

const MAX_ENTRIES = 100;
const entries: LogEntry[] = [];

/**
 * Log an error to console and store it in the ring buffer for the admin panel.
 * Pass an optional `error` to automatically append the stack trace.
 */
export function logError(
  category: string,
  message: string,
  endpoint?: string,
  error?: unknown,
): void {
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[${category}] ${message}`, ...(stack ? ["\n", stack] : []));
  if (process.env.NODE_ENV !== "production") return;
  entries.push({
    message,
    category,
    timestamp: new Date().toISOString(),
    endpoint: endpoint ?? null,
    ...(stack ? { stack } : {}),
  });
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

/**
 * Returns recent errors for the admin dashboard, newest first.
 */
export function getRecentErrors(): LogEntry[] {
  return entries.slice().reverse();
}
