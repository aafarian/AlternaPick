/**
 * Analyze historical pick data to validate notch shift percentages
 * and estimate hit rates at each notch tier.
 *
 * Run: npx tsx scripts/analyze-notch-balance.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";
import { adjustLine, getStepSize } from "../src/lib/heatscore/compute";
import { NOTCH_SHIFT_PCT, NOTCH_TIERS } from "../src/lib/heatscore/constants";
import type { StatCategory } from "../src/lib/supabase/types";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PickRow {
  selection: "over" | "under";
  result: "hit" | "miss" | "push" | "dnp";
  actual_value: number | null;
  props: {
    line: number;
    stat_category: StatCategory;
  };
}

async function main() {
  console.log("Fetching resolved picks with actual values...\n");

  // Fetch in batches to handle large datasets
  const allPicks: PickRow[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("picks")
      .select("selection, result, actual_value, props:props!inner(line, stat_category)")
      .not("actual_value", "is", null)
      .in("result", ["hit", "miss"])
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("Query error:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allPicks.push(...(data as unknown as PickRow[]));
    offset += batchSize;
    if (data.length < batchSize) break;
  }

  console.log(`Total scoreable picks: ${allPicks.length}\n`);

  if (allPicks.length === 0) {
    console.log("No data to analyze.");
    return;
  }

  // =========================================================================
  // 1. Overall hit rates by selection
  // =========================================================================
  const overPicks = allPicks.filter((p) => p.selection === "over");
  const underPicks = allPicks.filter((p) => p.selection === "under");
  const overHits = overPicks.filter((p) => p.result === "hit").length;
  const underHits = underPicks.filter((p) => p.result === "hit").length;

  console.log("=== Overall Hit Rates ===");
  console.log(`Over:  ${overHits}/${overPicks.length} = ${((overHits / overPicks.length) * 100).toFixed(1)}%`);
  console.log(`Under: ${underHits}/${underPicks.length} = ${((underHits / underPicks.length) * 100).toFixed(1)}%`);
  console.log(`Total: ${overHits + underHits}/${allPicks.length} = ${(((overHits + underHits) / allPicks.length) * 100).toFixed(1)}%`);
  console.log();

  // =========================================================================
  // 2. Margin distribution (how far actuals are from lines)
  // =========================================================================
  console.log("=== Margin Distribution (actual vs line) ===");
  console.log("Margin = |actual - line| / max(line, 5)");
  console.log();

  const margins = allPicks.map((p) => {
    const denom = Math.max(p.props.line, 5);
    return Math.abs((p.actual_value! - p.props.line) / denom);
  });

  margins.sort((a, b) => a - b);
  const p25 = margins[Math.floor(margins.length * 0.25)];
  const p50 = margins[Math.floor(margins.length * 0.5)];
  const p75 = margins[Math.floor(margins.length * 0.75)];
  const p90 = margins[Math.floor(margins.length * 0.9)];
  const p95 = margins[Math.floor(margins.length * 0.95)];

  console.log(`  25th percentile: ${(p25 * 100).toFixed(1)}%`);
  console.log(`  50th percentile: ${(p50 * 100).toFixed(1)}%`);
  console.log(`  75th percentile: ${(p75 * 100).toFixed(1)}%`);
  console.log(`  90th percentile: ${(p90 * 100).toFixed(1)}%`);
  console.log(`  95th percentile: ${(p95 * 100).toFixed(1)}%`);
  console.log();

  // =========================================================================
  // 3. Hit rates per stat category
  // =========================================================================
  console.log("=== Hit Rate by Stat Category ===");
  const catStats = new Map<string, { total: number; hits: number }>();

  for (const pick of allPicks) {
    const cat = pick.props.stat_category;
    const s = catStats.get(cat) ?? { total: 0, hits: 0 };
    s.total++;
    if (pick.result === "hit") s.hits++;
    catStats.set(cat, s);
  }

  const sortedCats = [...catStats.entries()].sort((a, b) => b[1].total - a[1].total);
  console.log("Category".padEnd(20), "Total".padStart(6), "Hit%".padStart(6), "Shift%".padStart(8));
  console.log("-".repeat(42));

  for (const [cat, s] of sortedCats) {
    const pct = NOTCH_SHIFT_PCT[cat as StatCategory];
    console.log(
      cat.padEnd(20),
      s.total.toString().padStart(6),
      ((s.hits / s.total) * 100).toFixed(1).padStart(5) + "%",
      pct ? (pct * 100).toFixed(0).padStart(7) + "%" : "    N/A",
    );
  }
  console.log();

  // =========================================================================
  // 4. Simulated hit rates at each notch level
  // =========================================================================
  console.log("=== Simulated Hit Rates at Each Notch Level ===");
  console.log("For each historical over pick: if the line had been shifted,");
  console.log("would the pick have still hit?");
  console.log();

  // Only use over picks for this simulation (notch picks are over-only)
  const overPicksWithData = overPicks.filter((p) => p.actual_value !== null);

  const notchHitRates: Record<number, { total: number; hits: number }> = {};
  for (let n = -2; n <= 3; n++) notchHitRates[n] = { total: 0, hits: 0 };

  // Per-category notch hit rates
  const catNotchHitRates = new Map<string, Record<number, { total: number; hits: number }>>();

  for (const pick of overPicksWithData) {
    const cat = pick.props.stat_category;
    const line = pick.props.line;
    const actual = pick.actual_value!;

    if (!catNotchHitRates.has(cat)) {
      const obj: Record<number, { total: number; hits: number }> = {};
      for (let n = -2; n <= 3; n++) obj[n] = { total: 0, hits: 0 };
      catNotchHitRates.set(cat, obj);
    }
    const catRates = catNotchHitRates.get(cat)!;

    for (let n = -2; n <= 3; n++) {
      const adjustedLine = adjustLine(line, cat, n);

      // Skip if this notch isn't available (floor issue)
      if (n < 0 && adjustedLine === line && n !== 0) continue;

      notchHitRates[n].total++;
      catRates[n].total++;

      if (actual > adjustedLine) {
        notchHitRates[n].hits++;
        catRates[n].hits++;
      }
    }
  }

  // Overall notch hit rates
  console.log("Notch".padEnd(18), "Hit Rate".padStart(10), "Total".padStart(8));
  console.log("-".repeat(38));

  for (const tier of NOTCH_TIERS) {
    const r = notchHitRates[tier.notch];
    if (r.total === 0) continue;
    const hitPct = ((r.hits / r.total) * 100).toFixed(1);
    console.log(
      `${tier.label} (${tier.notch >= 0 ? "+" : ""}${tier.notch})`.padEnd(18),
      (hitPct + "%").padStart(10),
      r.total.toString().padStart(8),
    );
  }

  console.log();

  // Per-category breakdown (top categories by volume)
  console.log("=== Per-Category Notch Hit Rates (top categories) ===");
  const topCats = sortedCats.filter(([, s]) => s.total >= 50).slice(0, 10);

  for (const [cat] of topCats) {
    const rates = catNotchHitRates.get(cat);
    if (!rates) continue;

    console.log(`\n  ${cat}:`);
    for (const tier of NOTCH_TIERS) {
      const r = rates[tier.notch];
      if (!r || r.total === 0) continue;
      const hitPct = ((r.hits / r.total) * 100).toFixed(1);
      const step = getStepSize(
        // Use median line for this category as representative
        allPicks.filter((p) => p.props.stat_category === cat).reduce((sum, p) => sum + p.props.line, 0) /
          allPicks.filter((p) => p.props.stat_category === cat).length,
        cat as StatCategory,
      );
      console.log(
        `    ${tier.label.padEnd(10)} ${hitPct.padStart(5)}%  (step: ${step}, n=${r.total})`,
      );
    }
  }

  console.log();

  // =========================================================================
  // 5. Balance assessment
  // =========================================================================
  console.log("=== Balance Assessment ===");
  console.log();

  const standardRate = notchHitRates[0].total > 0 ? notchHitRates[0].hits / notchHitRates[0].total : 0.5;

  for (const tier of NOTCH_TIERS) {
    if (tier.notch === 0) continue;
    const r = notchHitRates[tier.notch];
    if (r.total === 0) continue;

    const hitRate = r.hits / r.total;
    const dropFromStandard = standardRate - hitRate;

    // For balanced scoring: notch multiplier should roughly equal 1/hitRate
    // relative to standard. If standard hits 50% and volcanic hits 30%,
    // volcanic's multiplier should be ~50/30 = 1.67x to be balanced.
    const idealMultiplier = standardRate / hitRate;

    console.log(`${tier.label} (${tier.notch >= 0 ? "+" : ""}${tier.notch}):`);
    console.log(`  Hit rate: ${(hitRate * 100).toFixed(1)}% (${(dropFromStandard * 100).toFixed(1)}pp ${tier.notch > 0 ? "drop" : "gain"} from standard)`);
    console.log(`  Current multiplier: ${tier.multiplier}x`);
    console.log(`  Ideal multiplier (for balanced EV): ${idealMultiplier.toFixed(2)}x`);
    console.log(`  ${Math.abs(tier.multiplier - idealMultiplier) < 0.5 ? "✅ Balanced" : "⚠️  Needs adjustment"}`);
    console.log();
  }
}

main().catch(console.error);
