"use client";

export default function PropsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface py-20 text-center">
      <span className="text-4xl">⚠️</span>
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted">
        {error.message || "Failed to load props. Please try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
      >
        Try Again
      </button>
    </div>
  );
}
