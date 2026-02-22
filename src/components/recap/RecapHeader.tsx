import { ModeToggle } from "@/components/recap/ModeToggle";

interface RecapHeaderProps {
  title: string;
  subtitle: string;
  mode: "daily" | "weekly";
}

export function RecapHeader({ title, subtitle, mode }: RecapHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ModeToggle mode={mode} />
    </div>
  );
}
