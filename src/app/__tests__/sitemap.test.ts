import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the admin Supabase client (proxy-based, per-table results)
// ---------------------------------------------------------------------------

interface QueryResult {
  data?: unknown;
  error?: unknown;
}

let tableResults: Record<string, QueryResult> = {};

// Each createChainableQuery captures its OWN table name in closure so
// concurrent from() calls (e.g. Promise.all) don't trample a shared
// `currentTable` variable.
function createChainableQuery(table: string) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) =>
          resolve(tableResults[table] ?? { data: null, error: null });
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => createChainableQuery(table),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

import sitemap from "../sitemap";
import { SITE_URL } from "@/lib/constants";

beforeEach(() => {
  tableResults = {};
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sitemap", () => {
  it("always includes the static marketing routes", async () => {
    tableResults.profiles = { data: [], error: null };
    tableResults.challenges = { data: [], error: null };
    tableResults.leaderboard_entries = { data: [], error: null };

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/props`);
    expect(urls).toContain(`${SITE_URL}/leaderboard`);
    expect(urls).toContain(`${SITE_URL}/recap`);
  });

  it("includes public profile URLs from the database", async () => {
    tableResults.profiles = {
      data: [
        { username: "alice", updated_at: "2026-04-01T00:00:00Z" },
        { username: "bob", updated_at: "2026-04-02T00:00:00Z" },
      ],
      error: null,
    };
    tableResults.challenges = { data: [], error: null };
    tableResults.leaderboard_entries = { data: [], error: null };

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/users/alice`);
    expect(urls).toContain(`${SITE_URL}/users/bob`);
  });

  it("includes resolved challenge share URLs", async () => {
    tableResults.profiles = { data: [], error: null };
    tableResults.challenges = {
      data: [
        { id: "challenge-uuid-1", resolved_at: "2026-04-01T00:00:00Z" },
        { id: "challenge-uuid-2", resolved_at: "2026-04-02T00:00:00Z" },
      ],
      error: null,
    };
    tableResults.leaderboard_entries = { data: [], error: null };

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/challenges/challenge-uuid-1/share`);
    expect(urls).toContain(`${SITE_URL}/challenges/challenge-uuid-2/share`);
  });

  it("includes referral landing pages from leaderboard entries", async () => {
    tableResults.profiles = { data: [], error: null };
    tableResults.challenges = { data: [], error: null };
    tableResults.leaderboard_entries = {
      data: [
        {
          user_id: "u1",
          total_cards: 100,
          profiles: { username: "topplayer", is_deactivated: false },
        },
      ],
      error: null,
    };

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/join/topplayer`);
  });

  it("filters out deactivated referrers", async () => {
    tableResults.profiles = { data: [], error: null };
    tableResults.challenges = { data: [], error: null };
    tableResults.leaderboard_entries = {
      data: [
        {
          user_id: "u1",
          total_cards: 100,
          profiles: { username: "active", is_deactivated: false },
        },
        {
          user_id: "u2",
          total_cards: 50,
          profiles: { username: "banned", is_deactivated: true },
        },
      ],
      error: null,
    };

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/join/active`);
    expect(urls).not.toContain(`${SITE_URL}/join/banned`);
  });

  it("falls back gracefully when a Supabase query errors", async () => {
    tableResults.profiles = { data: null, error: { message: "DB down" } };
    tableResults.challenges = { data: [], error: null };
    tableResults.leaderboard_entries = { data: [], error: null };

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    // Static routes still present
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/props`);
    // No /users/* entries because the profiles query failed
    expect(urls.filter((u) => u.includes("/users/"))).toHaveLength(0);
  });
});
