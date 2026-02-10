import { NextResponse } from "next/server";

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

/** Return a 409 Conflict response. */
export function conflict(error: string) {
  return NextResponse.json<ApiErrorBody>({ error }, { status: 409 });
}

/**
 * Catch-all error handler for route catch blocks.
 * Checks for domain errors with a `.status` property first,
 * then falls back to a generic 500.
 */
export function handleApiError(error: unknown, fallbackMessage: string) {
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
