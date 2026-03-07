import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { unauthorized, badRequest, notFound, handleApiError } from "@/lib/api/errors";
import { logError } from "@/lib/logger";
import type { Challenge, NotificationPreferences } from "@/lib/supabase/types";
import {
  getChallenge,
  respondToChallenge,
} from "@/lib/challenges/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { id } = await context.params;

    const challenge = await getChallenge(supabase, id, user.id);

    if (!challenge) {
      return notFound("Challenge");
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    return handleApiError(error, "Failed to fetch challenge");
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { id } = await context.params;

    const body = (await request.json()) as {
      action?: string;
      convert_to_solo?: boolean;
    };

    if (!body.action) {
      return badRequest("action is required (accept, decline, or cancel)");
    }

    const validActions = ["accept", "decline", "cancel"];
    if (!validActions.includes(body.action)) {
      return badRequest(`Invalid action: ${body.action}. Must be accept, decline, or cancel`);
    }

    // For mirror/random accept: validate that mirror_props haven't expired
    let mirrorWarning: string | null = null;
    if (body.action === "accept") {
      const { data: rawChallenge } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", id)
        .single();

      const ch = rawChallenge as Challenge | null;
      if (ch?.mirror_props && ch.mirror_props.length > 0) {
        const LOCK_BUFFER_MS = 5 * 60 * 1000;
        const lockCutoff = new Date(Date.now() + LOCK_BUFFER_MS);

        // Fetch the games for these props to check commence times
        const { data: propGames } = await supabase
          .from("props")
          .select("id, game_id, games(commence_time)")
          .in("id", ch.mirror_props);

        const props = (propGames ?? []) as Array<{
          id: string;
          game_id: string;
          games: { commence_time: string } | null;
        }>;

        const validProps = props.filter(
          (p) =>
            p.games && new Date(p.games.commence_time) > lockCutoff
        );
        const expiredCount = ch.mirror_props.length - validProps.length;

        if (expiredCount > 0 && validProps.length === 0) {
          // ALL props expired — auto-cancel the challenge
          await respondToChallenge(supabase, id, ch.challenger_id, "cancel");
          return NextResponse.json(
            {
              error: "All props on this challenge have expired. Challenge has been cancelled.",
              cancelled: true,
            },
            { status: 409 }
          );
        }

        if (expiredCount > 0) {
          // Some props expired — filter them out and warn
          const validPropIds = validProps.map((p) => p.id);
          const adminClient = createAdminClient();
          await (adminClient.from("challenges") as any)
            .update({
              mirror_props: validPropIds,
              card_size: validPropIds.length,
            })
            .eq("id", id);
          mirrorWarning = `${expiredCount} prop(s) expired and were removed from the challenge.`;
        }
      }
    }

    const challenge = await respondToChallenge(
      supabase,
      id,
      user.id,
      body.action as "accept" | "decline" | "cancel",
      body.action === "cancel" ? body.convert_to_solo : undefined
    );

    // Fire-and-forget: notify challenger when opponent accepts
    if (body.action === "accept") {
      try {
        const adminClient = createAdminClient();
        const ch = challenge as Challenge;
        const [{ data: opponentProfile }, { data: challengerProfile }] =
          await Promise.all([
            (adminClient.from("profiles") as any)
              .select("username")
              .eq("id", user.id)
              .single() as Promise<{
              data: { username: string } | null;
            }>,
            (adminClient.from("profiles") as any)
              .select("notification_preferences")
              .eq("id", ch.challenger_id)
              .single() as Promise<{
              data: { notification_preferences: NotificationPreferences | null } | null;
            }>,
          ]);
        const opponentName =
          (opponentProfile as { username: string } | null)?.username ?? "Someone";
        const challengerPrefs = challengerProfile?.notification_preferences ?? null;
        await createNotification(adminClient, {
          user_id: ch.challenger_id,
          type: "challenge_accepted",
          title: "Challenge Accepted",
          body: `${opponentName} accepted your challenge!`,
          metadata: { challenge_id: ch.id },
        }, challengerPrefs);
      } catch (notifError) {
        logError("challenges", "Failed to create challenge_accepted notification", undefined, notifError);
      }
    }

    const response: Record<string, unknown> = { challenge };
    if (mirrorWarning) response.warning = mirrorWarning;
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "Failed to update challenge");
  }
}
