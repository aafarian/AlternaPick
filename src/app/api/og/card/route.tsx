import { ImageResponse } from "@vercel/og";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GameMode } from "@/lib/supabase/types";
import {
  OG_COLORS,
  formatScore,
  resultIcon,
  statLabel,
  modeBadgeText,
  directionLabel,
} from "@/lib/share/image-utils";

export const runtime = "edge";

/**
 * GET /api/og/card?cardId=<uuid>
 *
 * Generates a 1200x630 OG image for a shared card.
 * Public route — no auth required so social media crawlers can access it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("cardId");

  if (!cardId) {
    return new Response("Missing cardId", { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch card with picks + prop data
  const { data: card, error } = await (admin.from("cards") as any)
    .select(
      "id, user_id, status, score, total_picks, game_mode, card_size, picks(id, selection, result, actual_value, props(player_name, stat_category, line))"
    )
    .eq("id", cardId)
    .single();

  if (error || !card) {
    return new Response("Card not found", { status: 404 });
  }

  // Fetch username
  let username = "Anonymous";
  if (card.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("username")
      .eq("id", card.user_id)
      .single();

    if (profile) {
      username = (profile as { username: string }).username;
    }
  }

  const gameMode = (card.game_mode ?? "classic") as GameMode;
  const scoreText = formatScore(card.score, card.total_picks);
  const isGood = card.score >= card.total_picks / 2;
  const scoreColor = card.status === "resolved"
    ? isGood
      ? OG_COLORS.green
      : OG_COLORS.red
    : OG_COLORS.amber;

  const picks = (card.picks ?? []) as Array<{
    id: string;
    selection: string;
    result: string;
    actual_value: number | null;
    props: { player_name: string; stat_category: string; line: number } | null;
  }>;

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
        {/* Header row: branding + mode badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
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

        {/* User row + score */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Avatar circle */}
            <div
              style={{
                display: "flex",
                width: "48px",
                height: "48px",
                borderRadius: "9999px",
                backgroundColor: OG_COLORS.surface,
                border: `2px solid ${OG_COLORS.green}`,
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700,
                color: OG_COLORS.green,
                marginRight: "12px",
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: OG_COLORS.text,
              }}
            >
              {username}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span
              style={{
                fontSize: "56px",
                fontWeight: 900,
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {scoreText}
            </span>
          </div>
        </div>

        {/* Picks list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {picks.slice(0, 6).map((pick) => {
            const isHit = pick.result === "hit";
            const isMiss = pick.result === "miss";
            const dotColor = isHit
              ? OG_COLORS.green
              : isMiss
                ? OG_COLORS.red
                : OG_COLORS.amber;
            const icon = resultIcon(pick.result);
            const playerName = pick.props?.player_name ?? "Unknown";
            const stat = pick.props ? statLabel(pick.props.stat_category) : "";
            const line = pick.props?.line ?? 0;
            const direction = directionLabel(pick.selection);
            const dirColor =
              pick.selection === "over" ? OG_COLORS.green : OG_COLORS.red;

            return (
              <div
                key={pick.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: OG_COLORS.surface,
                  borderRadius: "12px",
                  padding: "12px 18px",
                  border: `1px solid ${OG_COLORS.border}`,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span
                    style={{
                      fontSize: "22px",
                      color: dotColor,
                      fontWeight: 700,
                      width: "28px",
                      textAlign: "center",
                    }}
                  >
                    {icon}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: OG_COLORS.text,
                      }}
                    >
                      {playerName}
                    </span>
                    <span
                      style={{
                        fontSize: "14px",
                        color: OG_COLORS.muted,
                      }}
                    >
                      {stat}
                    </span>
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: OG_COLORS.text,
                    }}
                  >
                    {line}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: dirColor,
                      backgroundColor:
                        pick.selection === "over"
                          ? "rgba(34,197,94,0.15)"
                          : "rgba(239,68,68,0.15)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    {direction}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "16px",
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
