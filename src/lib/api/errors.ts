import { NextResponse } from "next/server";
import { logError as logToBuffer } from "@/lib/logger";

/**
 * Standard API error response shape:
 *   { error: string, message?: string }
 *
 * Use these helpers in API route handlers to keep error responses consistent.
 */

export type ApiErrorBody = {
  error: string;
  message?: string;
};

/** Return a 400 Bad Request response. */
export function badRequest(error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status: 400 });
}

/** Return a 401 Unauthorized response. */
export function unauthorized() {
  return NextResponse.json<ApiErrorBody>(
    { error: "Authentication required" },
    { status: 401 }
  );
}

/** Return a 404 Not Found response. */
export function notFound(resource: string) {
  return NextResponse.json<ApiErrorBody>(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

/** Return a 403 Forbidden response. */
export function forbidden(error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status: 403 });
}

/** Return a 409 Conflict response. */
export function conflict(error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status: 409 });
}

/** Return a 429 Too Many Requests response. */
export function tooManyRequests(error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status: 429 });
}

/** Return a 500 Internal Server Error response. */
export function serverError(error: string, message?: string) {
  return NextResponse.json<ApiErrorBody>({ error, message }, { status: 500 });
}

/**
 * Structured error logger for API routes.
 * Logs error with context for debugging/tracing.
 * Placeholder for future Sentry/logging service integration.
 */
export function logError(
  error: unknown,
  context: {
    route: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logToBuffer(
    "api",
    JSON.stringify({
      level: "error",
      timestamp,
      route: context.route,
      userId: context.userId ?? null,
      message,
      ...(context.metadata ? { metadata: context.metadata } : {}),
    }),
    context.route,
    stack ? error : undefined
  );
}

/**
 * Catch-all error handler for route catch blocks.
 * Checks for domain errors with a `.status` property first,
 * then falls back to a generic 500.
 * Always logs to stderr so errors are visible in the terminal.
 */
export function handleApiError(error: unknown, fallbackMessage: string) {
  // Always log the full error to the terminal
  logToBuffer("api", `[API Error] ${fallbackMessage}`, undefined, error);

  // Domain errors (ValidationError, NotFoundError, ConflictError, etc.)
  if (
    error instanceof Error &&
    "status" in error &&
    typeof (error as any).status === "number"
  ) {
    return NextResponse.json<ApiErrorBody>(
      { error: error.message },
      { status: (error as any).status }
    );
  }

  const message =
    error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json<ApiErrorBody>(
    { error: fallbackMessage, message },
    { status: 500 }
  );
}
