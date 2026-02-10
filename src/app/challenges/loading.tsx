export default function ChallengesLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-card" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-card" />
      </div>

      {/* Tab skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-lg bg-card"
          />
        ))}
      </div>

      {/* Card skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
