export default function LeaderboardLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Title skeleton */}
      <div>
        <div className="h-8 w-44 animate-pulse rounded-lg bg-card" />
        <div className="mt-2 h-4 w-28 animate-pulse rounded bg-card" />
      </div>

      {/* Tab skeleton */}
      <div className="flex gap-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-lg bg-card"
          />
        ))}
      </div>

      {/* Rank card skeleton */}
      <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />

      {/* Row skeletons */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
