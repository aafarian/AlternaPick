import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <p className="text-sm font-bold tracking-tight">
          <span className="text-primary">Sports</span>
          <span className="text-foreground">Tower</span>
        </p>
        <Separator className="mx-auto my-3 max-w-32" />
        <p className="text-xs text-muted-foreground">Built for NBA fans.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} SportsTower. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
