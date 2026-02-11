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
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Tonight&apos;s Props
      </h1>
      <p className="text-sm text-muted-foreground">
        {today} &middot; {gameCount} game{gameCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
