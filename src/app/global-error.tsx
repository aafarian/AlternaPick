"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try Again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global error boundary cannot use next/link */}
            <a
              href="/"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
