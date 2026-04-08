import { describe, it, expect } from "vitest";
import { canonicalUrl, buildPageMetadata } from "../page-metadata";
import { SITE_URL } from "@/lib/constants";

describe("canonicalUrl", () => {
  it("returns SITE_URL for the root path", () => {
    expect(canonicalUrl("/")).toBe(SITE_URL);
    expect(canonicalUrl("")).toBe(SITE_URL);
  });

  it("appends the path to SITE_URL", () => {
    expect(canonicalUrl("/leaderboard")).toBe(`${SITE_URL}/leaderboard`);
    expect(canonicalUrl("/users/alice")).toBe(`${SITE_URL}/users/alice`);
  });

  it("strips trailing slashes (except root)", () => {
    expect(canonicalUrl("/leaderboard/")).toBe(`${SITE_URL}/leaderboard`);
    expect(canonicalUrl("/users/alice///")).toBe(`${SITE_URL}/users/alice`);
  });

  it("normalises a missing leading slash", () => {
    expect(canonicalUrl("props")).toBe(`${SITE_URL}/props`);
  });
});

describe("buildPageMetadata", () => {
  const meta = buildPageMetadata({
    title: "Leaderboard",
    description: "See who's winning",
    path: "/leaderboard",
  });

  it("sets a per-page title", () => {
    expect(meta.title).toBe("Leaderboard");
  });

  it("sets the canonical URL", () => {
    const alt = meta.alternates as { canonical: string };
    expect(alt.canonical).toBe(`${SITE_URL}/leaderboard`);
  });

  it("populates an OpenGraph block with the same title/description", () => {
    const og = meta.openGraph as { title: string; description: string; url: string };
    expect(og.title).toBe("Leaderboard");
    expect(og.description).toBe("See who's winning");
    expect(og.url).toBe(`${SITE_URL}/leaderboard`);
  });

  it("populates a Twitter card with summary_large_image", () => {
    const tw = meta.twitter as { card: string; title: string };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBe("Leaderboard");
  });

  it("uses /og-image.png by default", () => {
    const og = meta.openGraph as { images: Array<{ url: string }> };
    expect(og.images[0].url).toBe("/og-image.png");
  });

  it("respects an ogImage override", () => {
    const custom = buildPageMetadata({
      title: "Test",
      description: "Test",
      path: "/test",
      ogImage: "/custom.png",
    });
    const og = custom.openGraph as { images: Array<{ url: string }> };
    expect(og.images[0].url).toBe("/custom.png");
  });
});
