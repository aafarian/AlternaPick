import { ImageResponse } from "next/og";

// File-based convention: Next.js auto-wires this as the OG image for the
// homepage. The static og-image.png in /public stays as the inherited
// fallback for routes that don't define their own opengraph-image.

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt =
  "AlternaPick — Predict over/unders on real player props. Challenge friends, climb the leaderboard.";

// Brand palette mirrored from src/app/globals.css and src/lib/email/styles.ts
const BG = "#09090b"; // zinc-950
const FG = "#ffffff";
const NEON = "#00d26a";
const ZINC_400 = "#a1a1aa";
const ZINC_500 = "#71717a";
const ZINC_700 = "#3f3f46";
const ZINC_800 = "#27272a";
const ZINC_900 = "#18181b";
const ORANGE = "#fb923c"; // basketball-ish accent for the points pill

// Fake but realistic props that communicate "this is a player props game" at
// a glance. Static so the OG endpoint never depends on a DB call — crawlers
// hammer it constantly and any failure mode would silently break previews.
const FAKE_PROPS = [
  {
    name: "LeBron James",
    team: "LAL",
    sport: "NBA",
    line: "24.5",
    stat: "POINTS",
    direction: "OVER",
  },
  {
    name: "Stephen Curry",
    team: "GSW",
    sport: "NBA",
    line: "4.5",
    stat: "3PM",
    direction: "OVER",
  },
  {
    name: "Nikola Jokić",
    team: "DEN",
    sport: "NBA",
    line: "11.5",
    stat: "REB",
    direction: "OVER",
  },
];

function PropCard({
  prop,
  rotation,
  offsetY,
}: {
  prop: (typeof FAKE_PROPS)[number];
  rotation: number;
  offsetY: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: ZINC_900,
        border: `1px solid ${ZINC_800}`,
        borderRadius: 16,
        padding: "20px 24px",
        width: 360,
        boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
        transform: `rotate(${rotation}deg) translateY(${offsetY}px)`,
        gap: 12,
      }}
    >
      {/* Player + team */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            color: FG,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {prop.name}
        </div>
        <div
          style={{
            color: ZINC_500,
            fontSize: 13,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {prop.team} · {prop.sport}
        </div>
      </div>

      {/* Stat pill + line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(251, 146, 60, 0.15)",
            color: ORANGE,
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {prop.stat}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: NEON,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          <span>▲ {prop.direction}</span>
          <span style={{ color: FG }}>{prop.line}</span>
        </div>
      </div>
    </div>
  );
}

export default async function HomepageOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, ${BG} 0%, ${ZINC_900} 100%)`,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "60px 80px",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Subtle radial accent in the corner */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            background:
              "radial-gradient(circle, rgba(0,210,106,0.15) 0%, rgba(0,210,106,0) 70%)",
            display: "flex",
          }}
        />

        {/* Left half: brand + tagline + value props */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 28,
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 0,
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            <span style={{ color: NEON }}>Alterna</span>
            <span style={{ color: FG }}>Pick</span>
          </div>

          {/* Tagline */}
          <div
            style={{
              display: "flex",
              color: FG,
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              maxWidth: 520,
            }}
          >
            Predict. Compete. Dominate.
          </div>

          {/* Subhead */}
          <div
            style={{
              display: "flex",
              color: ZINC_400,
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1.4,
              maxWidth: 540,
            }}
          >
            Pick over/unders on real player props. Challenge friends head-to-head and
            climb the leaderboard. Free to play.
          </div>

          {/* Sport row */}
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 8,
            }}
          >
            {["🏀 NBA", "🏈 NFL", "⚽ Soccer", "🎓 NCAAB"].map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  background: ZINC_800,
                  color: ZINC_400,
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 16,
                  fontWeight: 600,
                  border: `1px solid ${ZINC_700}`,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Right half: stacked prop cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: -20,
            width: 420,
            position: "relative",
          }}
        >
          <PropCard prop={FAKE_PROPS[0]} rotation={-4} offsetY={0} />
          <PropCard prop={FAKE_PROPS[1]} rotation={2} offsetY={-30} />
          <PropCard prop={FAKE_PROPS[2]} rotation={-2} offsetY={-60} />
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
