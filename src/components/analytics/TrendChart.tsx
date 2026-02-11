import type { TrendPoint } from "@/lib/analytics/types";

interface TrendChartProps {
  data: TrendPoint[];
}

export default function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        30-Day Trend
      </h2>

      {/* CSS grid bar chart */}
      <div className="flex items-end gap-[2px]" style={{ height: "120px" }}>
        {data.map((point) => {
          const pct = Math.round(point.rate * 100);
          // Bar height based on total picks (volume), colored by hit rate
          const heightPct =
            maxTotal > 0 ? Math.max((point.total / maxTotal) * 100, 8) : 8;
          const isHot = pct >= 60;
          const isCold = pct < 40;

          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-lg group-hover:block">
                {formatDate(point.date)}: {pct}% ({point.hits}/{point.total})
              </div>

              {/* Bar */}
              <div
                className={`w-full min-w-[4px] rounded-t transition-all ${
                  isHot
                    ? "bg-neon-green/60"
                    : isCold
                      ? "bg-bold-red/50"
                      : "bg-electric-blue/50"
                }`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels (first and last date) */}
      {data.length >= 2 && (
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatDate(data[0].date)}</span>
          <span>{formatDate(data[data.length - 1].date)}</span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-neon-green/60" />
          60%+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-electric-blue/50" />
          40-59%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-bold-red/50" />
          &lt;40%
        </span>
        <span className="ml-auto">Bar height = pick volume</span>
      </div>
    </div>
  );
}

/** Format YYYY-MM-DD to a short M/D label */
function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(month, 10)}/${parseInt(day, 10)}`;
}
