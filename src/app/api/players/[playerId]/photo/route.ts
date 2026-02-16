import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

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

    const srcBuffer = Buffer.from(await response.arrayBuffer());

    // Remove white/near-white background by making those pixels transparent
    const { data, info } = await sharp(srcBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data.buffer);
    const threshold = 215; // pixels with R,G,B all above this become transparent

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (r >= threshold && g >= threshold && b >= threshold) {
        pixels[i + 3] = 0; // set alpha to 0 (transparent)
      }
    }

    const output = await sharp(Buffer.from(pixels.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
