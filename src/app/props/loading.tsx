function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-2">
          <div className="h-5 w-24 rounded bg-border" />
          <div className="h-5 w-4 rounded bg-border" />
          <div className="h-5 w-24 rounded bg-border" />
        </div>
        <div className="h-5 w-16 rounded bg-border" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-28 rounded bg-border" />
              <div className="h-5 w-10 rounded bg-border" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-10 rounded bg-border" />
              <div className="flex gap-1">
                <div className="h-5 w-10 rounded bg-border" />
                <div className="h-5 w-12 rounded bg-border" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PropsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-56 animate-pulse rounded bg-border" />
        <div className="h-4 w-40 animate-pulse rounded bg-border" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 animate-pulse rounded-full bg-border"
          />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
