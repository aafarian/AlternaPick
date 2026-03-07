import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAllFlags, setFlag } from "@/lib/feature-flags";
import { badRequest, handleApiError } from "@/lib/api/errors";

/**
 * GET /api/admin/feature-flags
 * Returns all feature flags for the admin dashboard.
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const flags = await getAllFlags();
    return NextResponse.json(flags);
  } catch (error) {
    return handleApiError(error, "Failed to fetch feature flags");
  }
}

/**
 * PUT /api/admin/feature-flags
 * Updates a single feature flag by key.
 *
 * Body: { key: string, value?: string, enabled?: boolean }
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const body = await request.json();
    const { key, value, enabled } = body as {
      key?: string;
      value?: string;
      enabled?: boolean;
    };

    if (!key || typeof key !== "string") {
      return badRequest("Missing required field: key");
    }

    if (value === undefined && enabled === undefined) {
      return badRequest("At least one of 'value' or 'enabled' must be provided");
    }

    const updates: { value?: string; enabled?: boolean } = {};
    if (value !== undefined) updates.value = value;
    if (enabled !== undefined) updates.enabled = enabled;

    const success = await setFlag(key, updates);

    if (!success) {
      return handleApiError(
        new Error(`Failed to update flag "${key}"`),
        "Failed to update feature flag",
      );
    }

    return NextResponse.json({ success: true, key });
  } catch (error) {
    return handleApiError(error, "Failed to update feature flag");
  }
}
