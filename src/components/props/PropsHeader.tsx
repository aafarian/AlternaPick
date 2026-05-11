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
      <h1 className="text-2xl font-black tracking-tight">
        Player <span className="text-primary">Props</span>
      </h1>
      <p className="text-xs text-muted-foreground">
        {today} &middot; {gameCount} game{gameCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
