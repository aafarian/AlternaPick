import { ImageResponse } from "@vercel/og";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GameMode } from "@/lib/supabase/types";
import {
  OG_COLORS,
  formatScore,
  modeBadgeText,
} from "@/lib/share/image-utils";

export const runtime = "edge";

/**
 * GET /api/og/challenge?challengeId=<uuid>
 *
 * Generates a 1200x630 OG image for a challenge share.
 * Public route -- no auth required so social media crawlers can access it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challengeId = searchParams.get("challengeId");

  if (!challengeId) {
    return new Response("Missing challengeId", { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch challenge
  const { data: challenge, error: challengeError } = await (
    admin.from("challenges") as any
  )
    .select("id, challenger_id, opponent_id, status, game_mode, winner_id, card_size")
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return new Response("Challenge not found", { status: 404 });
  }

  // Fetch both profiles
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", [challenge.challenger_id, challenge.opponent_id]);

  const profileMap = new Map<string, { username: string; display_name: string | null }>();
  for (const p of (profiles ?? []) as Array<{ id: string; username: string; display_name: string | null }>) {
    profileMap.set(p.id, p);
  }

  const challengerProfile = profileMap.get(challenge.challenger_id);
  const opponentProfile = profileMap.get(challenge.opponent_id);

  const challengerName =
    challengerProfile?.display_name ?? challengerProfile?.username ?? "Player 1";
  const opponentName =
    opponentProfile?.display_name ?? opponentProfile?.username ?? "Player 2";

  // Fetch cards for this challenge
  const { data: cards } = await (admin.from("cards") as any)
    .select("id, user_id, score, total_picks, status")
    .eq("challenge_id", challengeId);

  const cardsList = (cards ?? []) as Array<{
    id: string;
    user_id: string | null;
    score: number;
    total_picks: number;
    status: string;
  }>;

  const challengerCard = cardsList.find(
    (c) => c.user_id === challenge.challenger_id
  );
  const opponentCard = cardsList.find(
    (c) => c.user_id === challenge.opponent_id
  );

  const challengerScore = challengerCard
    ? formatScore(challengerCard.score, challengerCard.total_picks)
    : "--";
  const opponentScore = opponentCard
    ? formatScore(opponentCard.score, opponentCard.total_picks)
    : "--";

  const gameMode = (challenge.game_mode ?? "classic") as GameMode;
  const isResolved = challenge.status === "resolved";
  const winnerId = challenge.winner_id as string | null;

  const challengerWon = winnerId === challenge.challenger_id;
  const opponentWon = winnerId === challenge.opponent_id;
  const isTie = isResolved && !winnerId;

  // Determine status text
  let statusText = "In Progress";
  if (isResolved) {
    if (isTie) {
      statusText = "Tie Game";
    } else if (challengerWon) {
      statusText = `${challengerName} Wins!`;
    } else {
      statusText = `${opponentName} Wins!`;
    }
  } else if (challenge.status === "pending") {
    statusText = "Pending";
  } else if (challenge.status === "accepted") {
    statusText = "Accepted";
  } else if (challenge.status === "active") {
    statusText = "Active";
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: OG_COLORS.bg,
          padding: "48px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header: branding + mode badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span
              style={{
                fontSize: "36px",
                fontWeight: 800,
                color: OG_COLORS.green,
              }}
            >
              Alterna
            </span>
            <span
              style={{
                fontSize: "36px",
                fontWeight: 800,
                color: OG_COLORS.text,
              }}
            >
              Pick
            </span>
          </div>
          <div
            style={{
              display: "flex",
              backgroundColor: OG_COLORS.surface,
              border: `1px solid ${OG_COLORS.border}`,
              borderRadius: "9999px",
              padding: "6px 16px",
              fontSize: "18px",
              color: OG_COLORS.muted,
            }}
          >
            {modeBadgeText(gameMode)}
          </div>
        </div>

        {/* Head-to-head section */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: "40px",
          }}
        >
          {/* Challenger */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                display: "flex",
                width: "80px",
                height: "80px",
                borderRadius: "9999px",
                backgroundColor: OG_COLORS.surface,
                border: `3px solid ${challengerWon ? OG_COLORS.green : OG_COLORS.border}`,
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px",
                fontWeight: 700,
                color: challengerWon ? OG_COLORS.green : OG_COLORS.text,
                marginBottom: "12px",
              }}
            >
              {challengerName.charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: OG_COLORS.text,
                marginBottom: "8px",
                maxWidth: "200px",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {challengerName}
            </span>
            <span
              style={{
                fontSize: "64px",
                fontWeight: 900,
                color: challengerWon
                  ? OG_COLORS.green
                  : isTie
                    ? OG_COLORS.amber
                    : isResolved
                      ? OG_COLORS.red
                      : OG_COLORS.text,
                lineHeight: 1,
              }}
            >
              {challengerScore}
            </span>
            {challengerWon && (
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: OG_COLORS.green,
                  marginTop: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Winner
              </span>
            )}
          </div>

          {/* VS divider */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "32px",
                fontWeight: 900,
                color: OG_COLORS.muted,
                letterSpacing: "0.1em",
              }}
            >
              VS
            </span>
          </div>

          {/* Opponent */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                display: "flex",
                width: "80px",
                height: "80px",
                borderRadius: "9999px",
                backgroundColor: OG_COLORS.surface,
                border: `3px solid ${opponentWon ? OG_COLORS.green : OG_COLORS.border}`,
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px",
                fontWeight: 700,
                color: opponentWon ? OG_COLORS.green : OG_COLORS.text,
                marginBottom: "12px",
              }}
            >
              {opponentName.charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: OG_COLORS.text,
                marginBottom: "8px",
                maxWidth: "200px",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {opponentName}
            </span>
            <span
              style={{
                fontSize: "64px",
                fontWeight: 900,
                color: opponentWon
                  ? OG_COLORS.green
                  : isTie
                    ? OG_COLORS.amber
                    : isResolved
                      ? OG_COLORS.red
                      : OG_COLORS.text,
                lineHeight: 1,
              }}
            >
              {opponentScore}
            </span>
            {opponentWon && (
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: OG_COLORS.green,
                  marginTop: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Winner
              </span>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "24px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              backgroundColor: OG_COLORS.surface,
              border: `1px solid ${OG_COLORS.border}`,
              borderRadius: "12px",
              padding: "10px 28px",
              fontSize: "20px",
              fontWeight: 700,
              color: isResolved
                ? isTie
                  ? OG_COLORS.amber
                  : OG_COLORS.green
                : OG_COLORS.muted,
            }}
          >
            {statusText}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "8px",
            fontSize: "14px",
            color: OG_COLORS.muted,
          }}
        >
          alternapick.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
