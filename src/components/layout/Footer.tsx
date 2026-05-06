import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <p className="text-sm font-bold tracking-tight">
          <span className="text-primary">Alterna</span>
          <span className="text-foreground">Pick</span>
        </p>
        <Separator className="mx-auto my-3 max-w-32" />
        <p className="text-xs text-muted-foreground">The free alternative to sports betting.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} AlternaPick. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
