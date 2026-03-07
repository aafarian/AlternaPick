import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api/errors";
import { typedFrom } from "@/lib/supabase/typed-queries";
import type {
  RecapData,
  PersonalHighlight,
  WeeklyRecapData,
} from "@/lib/recaps/compute";

/**
 * GET /api/recaps
 * Returns pre-computed daily recap data.
 *
 * Query params:
 *   - date (optional): ISO date string (YYYY-MM-DD). If omitted, returns the
 *     most recent recap.
 *   - dates_only (optional): If "true", returns only the list of available
 *     recap dates as { dates: string[] }.
 *
 * Auth is optional:
 *   - Authenticated users receive their personal_highlights for the recap day.
 *   - Unauthenticated users receive personal_highlights as null.
 *
 * Caching:
 *   - Authenticated: Cache-Control: private, max-age=300
 *   - Unauthenticated: Cache-Control: public, max-age=300
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const dateParam = request.nextUrl.searchParams.get("date");
    const datesOnly = request.nextUrl.searchParams.get("dates_only") === "true";

    // Validate date format if provided
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // dates_only mode: return array of available recap dates
    // ------------------------------------------------------------------
    if (datesOnly) {
      const { data: rows, error } = await typedFrom(supabase, "recaps")
        .select("recap_date")
        .order("recap_date", { ascending: false });

      if (error) {
        throw new Error(`Failed to query recap dates: ${error.message}`);
      }

      const dates = (rows ?? []).map(
        (r: { recap_date: string }) => r.recap_date
      );

      return NextResponse.json(
        { dates },
        {
          headers: {
            "Cache-Control": "public, max-age=300",
          },
        }
      );
    }

    // ------------------------------------------------------------------
    // Standard mode: return full recap for a specific date or latest
    // ------------------------------------------------------------------

    // Check if user is authenticated (optional — not required)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch recap row
    let query = typedFrom(supabase, "recaps").select("*");

    if (dateParam) {
      query = query.eq("recap_date", dateParam);
    } else {
      query = query.order("recap_date", { ascending: false }).limit(1);
    }

    const { data: recap, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to query recaps: ${error.message}`);
    }

    // No recap found — return 404 with helpful empty response
    if (!recap) {
      return NextResponse.json(
        {
          error: "No recap available",
          latest_date: null,
        },
        { status: 404 }
      );
    }

    // Extract personal highlights for the authenticated user
    const personalHighlights: PersonalHighlight | null = user
      ? ((recap.personal_highlights as Record<string, PersonalHighlight>)[
          user.id
        ] ?? null)
      : null;

    const cacheControl = user
      ? "private, max-age=300"
      : "public, max-age=300";

    return NextResponse.json(
      {
        recap_date: recap.recap_date,
        recap_data: recap.recap_data as RecapData,
        personal_highlights: personalHighlights,
        weekly_data: (recap.weekly_data as WeeklyRecapData) ?? null,
        computed_at: recap.computed_at,
      },
      {
        headers: {
          "Cache-Control": cacheControl,
        },
      }
    );
  } catch (error) {
    return handleApiError(error, "Failed to fetch recap");
  }
}
