export default function NotificationsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-card" />
      <div className="h-4 w-64 animate-pulse rounded-lg bg-card" />
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
