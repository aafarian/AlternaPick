export default function ChallengeDetailLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-card" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-card" />
      </div>

      {/* Matchup card skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          {/* Player 1 */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 animate-pulse rounded-full bg-background/50" />
            <div className="h-4 w-20 animate-pulse rounded bg-background/50" />
            <div className="h-3 w-16 animate-pulse rounded bg-background/50" />
          </div>

          {/* VS */}
          <div className="h-6 w-8 animate-pulse rounded bg-background/50" />

          {/* Player 2 */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 animate-pulse rounded-full bg-background/50" />
            <div className="h-4 w-20 animate-pulse rounded bg-background/50" />
            <div className="h-3 w-16 animate-pulse rounded bg-background/50" />
          </div>
        </div>
      </div>

      {/* Card details skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
