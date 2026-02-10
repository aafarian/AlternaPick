export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
