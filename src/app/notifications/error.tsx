"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function NotificationsError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-semibold text-red-400">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted">
          {error.message || "Failed to load notifications"}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl border border-border bg-surface px-4 py-2 text-sm transition-colors hover:bg-surface-hover"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
