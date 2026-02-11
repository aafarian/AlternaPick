export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title skeleton */}
      <div className="h-8 w-28 animate-pulse rounded-lg bg-card" />

      {/* Tabs skeleton */}
      <div className="flex gap-1 rounded-lg bg-muted p-[3px]">
        {["Profile", "Notifications", "Account"].map((tab) => (
          <div
            key={tab}
            className="h-8 w-28 animate-pulse rounded-md bg-background/50"
          />
        ))}
      </div>

      {/* Tab content skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4">
          <div className="h-6 w-40 animate-pulse rounded bg-background/50" />
          <div className="h-4 w-72 animate-pulse rounded bg-background/50" />
          <div className="mt-4 flex flex-col gap-3">
            <div className="h-4 w-20 animate-pulse rounded bg-background/50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-background/50" />
            <div className="h-4 w-24 animate-pulse rounded bg-background/50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-background/50" />
            <div className="h-10 w-28 animate-pulse rounded-lg bg-background/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
