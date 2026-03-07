import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, notFound, forbidden, handleApiError } from "@/lib/api/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { id } = await context.params;

    // Fetch the card
    const { data: card, error: cardError } = await (supabase.from("cards") as any)
      .select("id, user_id, status, challenge_id")
      .eq("id", id)
      .single();

    if (cardError || !card) {
      return notFound("Card");
    }

    if (card.user_id !== user.id) {
      return forbidden("This card does not belong to you");
    }

    if (card.status !== "locked") {
      return badRequest("Can only cancel a locked card");
    }

    // Check if opponent has already submitted a card for this challenge
    if (card.challenge_id) {
      const admin = createAdminClient();
      const { data: otherCards } = await (admin.from("cards") as any)
        .select("id")
        .eq("challenge_id", card.challenge_id)
        .neq("user_id", user.id)
        .limit(1);

      if (otherCards && otherCards.length > 0) {
        return badRequest("Cannot cancel card after opponent has submitted");
      }
    }

    // Check that no games have started
    const { data: picks } = await (supabase.from("picks") as any)
      .select("id, props(game_id, games(commence_time))")
      .eq("card_id", id);

    const picksList = (picks ?? []) as Array<{
      id: string;
      props: { game_id: string; games: { commence_time: string } | null } | null;
    }>;

    const now = new Date();
    const hasStartedGame = picksList.some(
      (p) => p.props?.games && new Date(p.props.games.commence_time) <= now
    );

    if (hasStartedGame) {
      return badRequest("Cannot cancel — games already in progress");
    }

    // Delete card — picks cascade via ON DELETE CASCADE FK
    await (supabase.from("cards") as any).delete().eq("id", id);

    // If challenge-linked and no opponent card, cancel the challenge too
    if (card.challenge_id) {
      const admin = createAdminClient();
      await (admin.from("challenges") as any)
        .update({ status: "cancelled" })
        .eq("id", card.challenge_id)
        .in("status", ["pending", "accepted"]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Failed to cancel card");
  }
}
