"use client";

export default function CardsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="text-4xl">⚠️</span>
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted">Failed to load your cards.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
      >
        Try Again
      </button>
    </div>
  );
}
