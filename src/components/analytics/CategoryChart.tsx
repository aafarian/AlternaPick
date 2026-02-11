import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { CategoryStats } from "@/lib/analytics/types";
import type { StatCategory } from "@/lib/supabase/types";

interface CategoryChartProps {
  data: CategoryStats[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Hit Rate by Category
      </h2>
      <div className="flex flex-col gap-3">
        {data.map((item) => {
          const pct = Math.round(item.rate * 100);
          const label =
            CATEGORY_LABELS[item.category as StatCategory] ?? item.category;
          const colorClass =
            CATEGORY_COLORS[item.category as StatCategory] ??
            "bg-gray-500/20 text-gray-400";
          // Extract just the text color from the badge class for the bar fill
          const textColor = colorClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-gray-400";
          const barBg = textColor.replace("text-", "bg-").replace(/\/\d+$/, "") + "/30";

          return (
            <div key={item.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {pct}%{" "}
                  <span className="text-[10px]">
                    ({item.hits}/{item.total})
                  </span>
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${barBg}`}
                  style={{ width: `${pct}%` }}
                />
                {/* Volume indicator: faint overlay showing total picks relative to max */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground/5"
                  style={{
                    width: `${maxTotal > 0 ? (item.total / maxTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
