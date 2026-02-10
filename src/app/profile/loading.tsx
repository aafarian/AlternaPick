export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title skeleton */}
      <div className="h-8 w-28 animate-pulse rounded-lg bg-card" />

      {/* Profile card skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-background/50" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-32 animate-pulse rounded bg-background/50" />
            <div className="h-4 w-24 animate-pulse rounded bg-background/50" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-6 w-10 animate-pulse rounded bg-background/50" />
              <div className="h-3 w-14 animate-pulse rounded bg-background/50" />
            </div>
          ))}
        </div>
      </div>

      {/* Edit form skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4">
          <div className="h-5 w-20 animate-pulse rounded bg-background/50" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-background/50" />
          <div className="h-5 w-24 animate-pulse rounded bg-background/50" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-background/50" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-background/50" />
        </div>
      </div>
    </div>
  );
}
