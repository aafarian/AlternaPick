export default function FriendsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      <div className="h-8 w-36 animate-pulse rounded-lg bg-surface" />
      <div className="h-12 w-full animate-pulse rounded-2xl bg-surface" />
      <div className="h-6 w-48 animate-pulse rounded-lg bg-surface" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
        />
      ))}
    </div>
  );
}
