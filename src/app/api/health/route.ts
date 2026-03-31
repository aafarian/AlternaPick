import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logWarn } from "@/lib/logger";

/**
 * GET /api/health
 *
 * Lightweight health check for Docker HEALTHCHECK and deploy scripts.
 * Returns 200 if the app is running and can reach the database.
 * Returns 503 if the database is unreachable.
 *
 * No auth required — this endpoint is used by infrastructure tooling.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = { app: "ok" };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).limit(0);
    checks.db = error ? "fail" : "ok";
    if (error) {
      logWarn("health", "DB health check failed", error);
    }
  } catch (error) {
    checks.db = "fail";
    logWarn("health", "DB health check threw", error);
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
