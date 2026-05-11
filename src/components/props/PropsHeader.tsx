interface PropsHeaderProps {
  gameCount: number;
}

export default function PropsHeader({ gameCount }: PropsHeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex items-baseline justify-between">
      <h1 className="text-xl font-medium uppercase tracking-widest text-muted-foreground">
        Player Props
      </h1>
      <p className="text-xs text-muted-foreground">
        {today} &middot; {gameCount} game{gameCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
