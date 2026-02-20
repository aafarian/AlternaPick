import { NextRequest, NextResponse } from "next/server";
import { computeDailyRecap, computeWeeklyRecap } from "@/lib/recaps/compute";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { unauthorized, handleApiError } from "@/lib/api/errors";

function getYesterdayUTC(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
  // Auth: require SYNC_SECRET bearer token
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return unauthorized();
    }
  }

  try {
    // Parse optional date from request body
    const body = await request.json().catch(() => ({}));
    const targetDate: string = body.date || getYesterdayUTC();

    // Idempotency check: skip if recap was computed within the last hour
    const adminClient = createAdminClient();
    const { data: existingRecap } = await typedFrom(adminClient, "recaps")
      .select("computed_at, recap_data, weekly_data")
      .eq("recap_date", targetDate)
      .maybeSingle();

    if (existingRecap?.computed_at) {
      const computedAt = new Date(existingRecap.computed_at).getTime();
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      if (computedAt > oneHourAgo) {
        // Recently computed — return existing stats without re-computing or re-notifying
        const recapData = existingRecap.recap_data as Record<string, unknown>;

        // Still attempt weekly computation if it hasn't been done yet
        let weekly: { computed: boolean; days_included?: number; weekly_hit_rate?: number } =
          { computed: false };

        if (!existingRecap.weekly_data) {
          try {
            const weeklyResult = await computeWeeklyRecap(targetDate);
            weekly = {
              computed: true,
              days_included: weeklyResult.dailyTrend.length,
              weekly_hit_rate: weeklyResult.weeklyHitRate,
            };
          } catch (weeklyError) {
            console.error("Weekly recap computation failed (skipped path):", weeklyError);
            weekly = { computed: false };
          }
        } else {
          const wd = existingRecap.weekly_data as Record<string, unknown>;
          weekly = {
            computed: true,
            days_included: Array.isArray(wd.dailyTrend)
              ? (wd.dailyTrend as unknown[]).length
              : 0,
            weekly_hit_rate: typeof wd.weeklyHitRate === "number" ? wd.weeklyHitRate : 0,
          };
        }

        return NextResponse.json({
          recap_date: targetDate,
          skipped: true,
          message: "Recap already computed within the last hour",
          callout_count: Array.isArray(recapData?.trapProps)
            ? (recapData.trapProps as unknown[]).length +
              (Array.isArray(recapData?.lockProps)
                ? (recapData.lockProps as unknown[]).length
                : 0)
            : 0,
          computed_at: existingRecap.computed_at,
          weekly,
        });
      }
    }

    // Compute the daily recap (handles upsert + notifications internally)
    const { recapData, featuredUserIds } =
      await computeDailyRecap(targetDate);

    const calloutCount =
      recapData.trapProps.length +
      recapData.lockProps.length +
      recapData.playerSpotlightsGood.length +
      recapData.playerSpotlightsBad.length;

    const computedAt = new Date().toISOString();

    // Run weekly computation after daily succeeds (sequential, not parallel)
    let weekly: { computed: boolean; days_included?: number; weekly_hit_rate?: number } =
      { computed: false };

    try {
      const weeklyResult = await computeWeeklyRecap(targetDate);
      weekly = {
        computed: true,
        days_included: weeklyResult.dailyTrend.length,
        weekly_hit_rate: weeklyResult.weeklyHitRate,
      };
    } catch (weeklyError) {
      console.error("Weekly recap computation failed:", weeklyError);
      weekly = { computed: false };
    }

    return NextResponse.json({
      recap_date: targetDate,
      skipped: false,
      callout_count: calloutCount,
      featured_users_notified: featuredUserIds.length,
      total_picks: recapData.totalPicks,
      total_cards: recapData.totalCards,
      computed_at: computedAt,
      weekly,
    });
  } catch (error) {
    return handleApiError(error, "Recap computation failed");
  }
}
