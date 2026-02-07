import { NextRequest, NextResponse } from "next/server";
import { resolveEligibleCards } from "@/lib/cards/resolution";

export async function POST(request: NextRequest) {
  // Auth check
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await resolveEligibleCards();

    return NextResponse.json({
      resolved: results.length,
      results: results.map((r) => ({
        card_id: r.card_id,
        score: r.score,
        total: r.total,
        picks: r.picks.map((p) => ({
          player_name: p.player_name,
          stat_category: p.stat_category,
          line: p.line,
          selection: p.selection,
          actual_value: p.actual_value,
          result: p.result,
        })),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Resolution failed", message },
      { status: 500 }
    );
  }
}
