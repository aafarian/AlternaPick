export default function ShareCardLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Branding skeleton */}
      <div className="mb-8 h-8 w-40 animate-pulse rounded-lg bg-surface" />

      {/* Card container skeleton */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-xl">
        {/* Card header */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 animate-pulse rounded-full bg-background/50" />
              <div className="h-4 w-24 animate-pulse rounded bg-background/50" />
            </div>
            <div className="h-3 w-16 animate-pulse rounded bg-background/50" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 animate-pulse rounded bg-background/50" />
            <div className="h-8 w-12 animate-pulse rounded bg-background/50" />
          </div>
        </div>

        {/* Pick rows */}
        <div className="flex flex-col gap-1 p-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-background/50"
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 border-t border-border px-5 py-4">
          <div className="h-3 w-32 animate-pulse rounded bg-background/50" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-background/50" />
        </div>
      </div>
    </div>
  );
}
