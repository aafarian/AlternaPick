interface PropsHeaderProps {
  gameCount: number;
  dateLabel?: string;
}

export default function PropsHeader({ gameCount, dateLabel }: PropsHeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const title = dateLabel === "Upcoming"
    ? "Upcoming Props"
    : dateLabel === "Tonight"
      ? "Tonight\u2019s Props"
      : dateLabel
        ? `${dateLabel}\u2019s Props`
        : "Player Props";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">
        {today} &middot; {gameCount} game{gameCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
