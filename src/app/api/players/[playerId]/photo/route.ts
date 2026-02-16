import { NextRequest, NextResponse } from "next/server";

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;

  if (!playerId || !/^\d+$/.test(playerId)) {
    return new NextResponse(null, { status: 400 });
  }

  const url = `https://media.api-sports.io/football/players/${playerId}.png`;

  try {
    const response = await fetch(url, {
      headers: { "x-apisports-key": FOOTBALL_API_KEY },
      next: { revalidate: 86400 }, // cache 24h
    });

    if (!response.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
