export default function CardsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-card" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-card" />
      </div>
      <div className="h-6 w-32 animate-pulse rounded-lg bg-card" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
