import { describe, it, expect } from "vitest";
import { noIndexMetadata } from "../metadata";

describe("noIndexMetadata", () => {
  it("sets robots.index to false", () => {
    expect(noIndexMetadata.robots).toBeDefined();
    const robots = noIndexMetadata.robots as { index: boolean };
    expect(robots.index).toBe(false);
  });

  it("sets robots.follow to false", () => {
    const robots = noIndexMetadata.robots as { follow: boolean };
    expect(robots.follow).toBe(false);
  });

  it("sets googleBot.index to false explicitly", () => {
    const robots = noIndexMetadata.robots as {
      googleBot: { index: boolean; follow: boolean };
    };
    expect(robots.googleBot.index).toBe(false);
    expect(robots.googleBot.follow).toBe(false);
  });
});
