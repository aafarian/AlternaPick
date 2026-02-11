export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title skeleton */}
      <div>
        <div className="h-8 w-36 animate-pulse rounded-lg bg-card" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-card" />
      </div>

      {/* Summary card skeleton */}
      <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />

      {/* Chart grid skeletons */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
