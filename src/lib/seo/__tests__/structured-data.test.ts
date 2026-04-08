import { describe, it, expect } from "vitest";
import {
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from "../structured-data";

describe("organizationSchema", () => {
  it("declares schema.org context and Organization type", () => {
    expect(organizationSchema["@context"]).toBe("https://schema.org");
    expect(organizationSchema["@type"]).toBe("Organization");
  });

  it("has required fields", () => {
    expect(organizationSchema.name).toBe("AlternaPick");
    expect(organizationSchema.url).toMatch(/^https?:\/\//);
    expect(organizationSchema.logo).toMatch(/^https?:\/\/.*\.png$/);
  });

  it("serializes to valid JSON", () => {
    const json = JSON.stringify(organizationSchema);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("websiteSchema", () => {
  it("declares schema.org context and WebSite type", () => {
    expect(websiteSchema["@context"]).toBe("https://schema.org");
    expect(websiteSchema["@type"]).toBe("WebSite");
  });

  it("has required fields", () => {
    expect(websiteSchema.name).toBe("AlternaPick");
    expect(websiteSchema.url).toMatch(/^https?:\/\//);
  });
});

describe("softwareApplicationSchema", () => {
  it("declares schema.org context and SoftwareApplication type", () => {
    expect(softwareApplicationSchema["@context"]).toBe("https://schema.org");
    expect(softwareApplicationSchema["@type"]).toBe("SoftwareApplication");
  });

  it("declares it as a free GameApplication on Web", () => {
    expect(softwareApplicationSchema.applicationCategory).toBe("GameApplication");
    expect(softwareApplicationSchema.operatingSystem).toBe("Web");
    expect(softwareApplicationSchema.offers.price).toBe("0");
    expect(softwareApplicationSchema.offers.priceCurrency).toBe("USD");
  });

  it("does not include fabricated aggregateRating", () => {
    expect(softwareApplicationSchema).not.toHaveProperty("aggregateRating");
  });

  it("has a non-empty description", () => {
    expect(softwareApplicationSchema.description.length).toBeGreaterThan(20);
  });
});
