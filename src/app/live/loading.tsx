import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LiveLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-secondary" />
        <div className="mt-1 h-4 w-64 animate-pulse rounded bg-secondary" />
      </div>
      {[1, 2].map((i) => (
        <Card key={i} className="border-border bg-card">
          <CardHeader className="space-y-0 px-4 py-3">
            <div className="h-6 w-20 animate-pulse rounded bg-secondary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-3">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-24 animate-pulse rounded-xl bg-secondary"
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
