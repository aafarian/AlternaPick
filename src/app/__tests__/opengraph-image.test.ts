import { describe, it, expect, vi } from "vitest";

// Mock next/og's ImageResponse so we don't need a real edge runtime in tests.
// HomepageOG calls `new ImageResponse(...)`, so the mock must be constructable.
// Arrow functions can't be used with `new`, so we use a regular class that
// captures element + options as instance fields. `vi.mock` is hoisted, so
// everything must live inside the factory.
vi.mock("next/og", () => {
  class ImageResponse {
    element: unknown;
    options: unknown;
    constructor(element: unknown, options: unknown) {
      this.element = element;
      this.options = options;
    }
  }
  return { ImageResponse };
});

import HomepageOG, {
  alt,
  contentType,
  size,
  runtime,
} from "../opengraph-image";

describe("homepage opengraph-image", () => {
  it("declares the Open Graph card metadata Next.js expects", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(typeof alt).toBe("string");
    expect(alt.length).toBeGreaterThan(0);
    // Edge runtime is preferred for OG endpoints — the CDN can cache the
    // PNG geographically and crawlers don't have to wait on a cold node start.
    expect(runtime).toBe("edge");
  });

  it("returns an ImageResponse with the declared size", async () => {
    const result = (await HomepageOG()) as unknown as {
      options: { width: number; height: number };
      element: unknown;
    };

    expect(result.options.width).toBe(1200);
    expect(result.options.height).toBe(630);
    expect(result.element).toBeDefined();
  });

  it("alt text mentions the brand and the product category", () => {
    // The alt is what appears for screen readers + as Twitter card alt text.
    // Verify it includes the brand name and a hint of what the product is.
    expect(alt).toContain("AlternaPick");
    expect(alt.toLowerCase()).toMatch(/(props|player|over)/);
  });
});
