import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt =
  "AlternaPick — Predict over/unders on real player props. Challenge friends, climb the leaderboard.";

// Brand palette
const BG = "#09090b";
const FG = "#ffffff";
const NEON = "#00d26a";
const ZINC_400 = "#a1a1aa";
const ZINC_500 = "#71717a";
const ZINC_700 = "#3f3f46";
const ZINC_800 = "#27272a";
const ZINC_900 = "#18181b";

const FAKE_PROPS = [
  {
    name: "LeBron James",
    team: "LAL",
    position: "F",
    line: "24.5",
    stat: "POINTS",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/2544.png",
  },
  {
    name: "Stephen Curry",
    team: "GSW",
    position: "G",
    line: "4.5",
    stat: "3PM",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/201939.png",
  },
  {
    name: "Nikola Jokic",
    team: "DEN",
    position: "C",
    line: "11.5",
    stat: "REB",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/203999.png",
  },
];

function PropCard({
  prop,
  rotation,
  offsetY,
  highlighted,
}: {
  prop: (typeof FAKE_PROPS)[number];
  rotation: number;
  offsetY: number;
  highlighted?: boolean;
}) {
  const borderColor = highlighted
    ? `1.5px solid ${NEON}`
    : `1px solid ${ZINC_800}`;
  const glow = highlighted
    ? "0 0 30px rgba(0,210,106,0.25), 0 20px 50px -20px rgba(0,0,0,0.6)"
    : "0 20px 50px -20px rgba(0,0,0,0.6)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: ZINC_900,
        border: borderColor,
        borderRadius: 20,
        width: 210,
        boxShadow: glow,
        transform: `rotate(${rotation}deg) translateY(${offsetY}px)`,
        overflow: "hidden",
      }}
    >
      {/* Headshot */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          width: "100%",
          height: 120,
          background: `radial-gradient(circle at 50% 80%, rgba(0,210,106,0.1) 0%, transparent 70%)`,
        }}
      >
        <img
          src={prop.headshot}
          alt={prop.name}
          width={120}
          height={88}
          style={{ objectFit: "cover", objectPosition: "top" }}
        />
      </div>

      {/* Name + team */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 12px 0 12px",
          gap: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            color: FG,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          {prop.name}
        </div>
        <div
          style={{
            display: "flex",
            color: ZINC_500,
            fontSize: 10,
            fontWeight: 500,
          }}
        >
          {`${prop.team} - ${prop.position}`}
        </div>
      </div>

      {/* Line number */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          padding: "6px 12px",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            color: NEON,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {prop.line}
        </div>
        <div
          style={{
            display: "flex",
            color: NEON,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {prop.stat}
        </div>
      </div>

      {/* OVER / UNDER */}
      <div
        style={{
          display: "flex",
          width: "100%",
          borderTop: `1px solid ${ZINC_800}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: "8px 0",
            color: highlighted ? BG : NEON,
            background: highlighted ? NEON : "transparent",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            borderRight: `1px solid ${ZINC_800}`,
          }}
        >
          OVER
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: "8px 0",
            color: ZINC_500,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          UNDER
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
          background: `linear-gradient(160deg, ${BG} 0%, #0d1117 50%, ${BG} 100%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          position: "relative",
        }}
      >
        {/* Ambient glow — top right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 500,
            height: 500,
            background:
              "radial-gradient(circle, rgba(0,210,106,0.12) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Ambient glow — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: -120,
            left: -80,
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(0,210,106,0.06) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* ───── TOP: Brand + Tagline ───── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            paddingTop: 40,
            paddingBottom: 6,
            position: "relative",
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              fontSize: 52,
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
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {"Predict. Compete. Dominate."}
          </div>

          {/* Subhead — shorter for visual punch */}
          <div
            style={{
              display: "flex",
              color: ZINC_400,
              fontSize: 16,
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            {"Pick over/unders on real player props. Free to play."}
          </div>

          {/* Sport pills */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 8,
            }}
          >
            {["NBA", "NFL", "Soccer", "NCAAB"].map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  background: ZINC_800,
                  color: ZINC_400,
                  padding: "5px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${ZINC_700}`,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* ───── BOTTOM: Three prop cards ───── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 24,
            marginTop: 20,
            position: "relative",
          }}
        >
          <PropCard prop={FAKE_PROPS[0]} rotation={-5} offsetY={12} highlighted={false} />
          <PropCard prop={FAKE_PROPS[1]} rotation={0} offsetY={0} highlighted />
          <PropCard prop={FAKE_PROPS[2]} rotation={5} offsetY={12} highlighted={false} />
        </div>

        {/* CTA strip at the very bottom — urgency driver */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            justifyContent: "center",
            alignItems: "center",
            padding: "12px 0",
            background: `linear-gradient(transparent, rgba(0,210,106,0.08))`,
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              background: NEON,
              color: BG,
              padding: "6px 20px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {"Start picking now"}
          </div>
          <div
            style={{
              display: "flex",
              color: ZINC_500,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {"alternapick.com"}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
