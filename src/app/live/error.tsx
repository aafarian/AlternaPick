"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Live Tracker</h1>
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-4xl">&#x26A0;&#xFE0F;</span>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "Failed to load live tracker"}
          </p>
          <Button onClick={reset} variant="outline" size="sm">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
