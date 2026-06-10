import { describe, it, expect } from "vitest";
import { isOverOnlyCategory, OVER_ONLY_CATEGORIES } from "../config";

describe("isOverOnlyCategory", () => {
  it("flags home runs as over-only", () => {
    expect(isOverOnlyCategory("home_runs")).toBe(true);
  });

  it("flags stolen bases as over-only", () => {
    expect(isOverOnlyCategory("stolen_bases")).toBe(true);
  });

  it("flags goals as over-only", () => {
    expect(isOverOnlyCategory("goals")).toBe(true);
  });

  it("does not flag volume stats", () => {
    expect(isOverOnlyCategory("points")).toBe(false);
    expect(isOverOnlyCategory("rebounds")).toBe(false);
    expect(isOverOnlyCategory("hits")).toBe(false);
    expect(isOverOnlyCategory("total_bases")).toBe(false);
    expect(isOverOnlyCategory("rbis")).toBe(false);
    expect(isOverOnlyCategory("pitcher_strikeouts")).toBe(false);
  });

  it("exposes the underlying set for reuse", () => {
    expect(OVER_ONLY_CATEGORIES.has("home_runs")).toBe(true);
    expect(OVER_ONLY_CATEGORIES.has("points")).toBe(false);
  });
});
