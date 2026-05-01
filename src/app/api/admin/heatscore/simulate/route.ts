import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { badRequest, handleApiError } from "@/lib/api/errors";
import { simulateCardHeatScore } from "@/lib/heatscore/simulate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/heatscore/simulate
 *
 * Simulate the HeatScore for an existing resolved card.
 * Body: { card_id: string }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const body = await request.json();
    const cardId = body?.card_id;

    if (!cardId || typeof cardId !== "string" || !UUID_RE.test(cardId)) {
      return badRequest("Invalid or missing card_id (must be a UUID)");
    }

    const result = await simulateCardHeatScore(cardId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "Card not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Card is not resolved") {
      return badRequest(message);
    }

    return handleApiError(error, "admin/heatscore/simulate");
  }
}
