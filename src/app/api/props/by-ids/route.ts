import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return badRequest("ids query parameter is required (comma-separated prop IDs)");
    }

    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return badRequest("At least one prop ID is required");
    }

    if (ids.length > 20) {
      return badRequest("Maximum 20 prop IDs allowed");
    }

    const { data, error } = await supabase
      .from("props")
      .select("*, games(*)")
      .in("id", ids);

    if (error) {
      throw new Error(`Failed to fetch props: ${error.message}`);
    }

    return NextResponse.json({ props: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Failed to fetch props by IDs");
  }
}
