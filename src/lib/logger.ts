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
  const errorDetail = error instanceof Error
    ? error.stack
    : error != null
      ? JSON.stringify(error)
      : undefined;
  console.error(`[${category}] ${message}`, ...(errorDetail ? ["\n", errorDetail] : error !== undefined ? [error] : []));
  if (process.env.NODE_ENV !== "production") return;
  entries.push({
    message,
    category,
    timestamp: new Date().toISOString(),
    endpoint: endpoint ?? null,
    ...(errorDetail ? { stack: errorDetail } : {}),
  });
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
}

/**
 * Log an informational message to console. Not stored in the ring buffer.
 */
export function logInfo(category: string, message: string): void {
  console.log(`[${category}] ${message}`);
}

/**
 * Log a warning to console. Not stored in the ring buffer.
 */
export function logWarn(
  category: string,
  message: string,
  error?: unknown,
): void {
  console.warn(`[${category}] ${message}`, ...(error !== undefined ? [error] : []));
}

/**
 * Returns recent errors for the admin dashboard, newest first.
 */
export function getRecentErrors(): LogEntry[] {
  return entries.slice().reverse();
}
