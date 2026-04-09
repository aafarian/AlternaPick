import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (set up before importing the route module)
// ---------------------------------------------------------------------------

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/admin", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const mockLogError = vi.fn();
const mockLogInfo = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarn: vi.fn(),
}));

// Per-test state for the proxy-mocked admin Supabase client.
let fetchProfileResult: { data: unknown; error: unknown } = {
  data: { id: "u1", username: "alice", notification_preferences: null },
  error: null,
};
let updateError: unknown = null;
const mockUpdate = vi.fn();

vi.mock("@/lib/supabase/admin", () => {
  return {
    createAdminClient: () => ({
      from: () => {
        const handler: ProxyHandler<Record<string, unknown>> = {
          get(_target, prop) {
            if (prop === "single") {
              return () => Promise.resolve(fetchProfileResult);
            }
            if (prop === "then") {
              // Terminal await on the update chain
              return (resolve: (v: unknown) => void) =>
                resolve({ error: updateError });
            }
            return (...args: unknown[]) => {
              if (prop === "update") mockUpdate(...args);
              return new Proxy({}, handler);
            };
          },
        };
        return new Proxy({}, handler);
      },
    }),
  };
});

import { PATCH } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request("https://example.com", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validUuid = "11111111-2222-3333-4444-555555555555";
const params = Promise.resolve({ userId: validUuid });

function asAdmin() {
  requireAdminMock.mockResolvedValue({
    isAdmin: true,
    user: { id: "admin-1", email: "admin@example.com" },
  });
}

function asNonAdmin() {
  requireAdminMock.mockResolvedValue({
    isAdmin: false,
    response: new Response(null, { status: 404 }),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset();
  mockUpdate.mockClear();
  mockLogError.mockClear();
  mockLogInfo.mockClear();
  fetchProfileResult = {
    data: { id: "u1", username: "alice", notification_preferences: null },
    error: null,
  };
  updateError = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/users/[userId]/notification-preferences", () => {
  it("returns 404 for non-admin callers (endpoint is not discoverable)", async () => {
    asNonAdmin();

    const res = await PATCH(makeRequest({ email_friend_request: false }), {
      params,
    });

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid user ID format", async () => {
    asAdmin();

    const res = await PATCH(makeRequest({ email_friend_request: false }), {
      params: Promise.resolve({ userId: "not-a-uuid" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-JSON body", async () => {
    asAdmin();

    const res = await PATCH(makeRequest("not json"), { params });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown preference key", async () => {
    asAdmin();

    const res = await PATCH(makeRequest({ malicious_key: false }), { params });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown preference key");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-boolean value", async () => {
    asAdmin();

    const res = await PATCH(makeRequest({ email_friend_request: "false" }), {
      params,
    });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty body (nothing to update)", async () => {
    asAdmin();

    const res = await PATCH(makeRequest({}), { params });

    expect(res.status).toBe(400);
  });

  it("merges the new preferences into the existing JSONB and writes once", async () => {
    asAdmin();
    fetchProfileResult = {
      data: {
        id: "u1",
        username: "alice",
        notification_preferences: {
          email_card_resolved: true,
          friend_request: true,
        },
      },
      error: null,
    };

    const res = await PATCH(
      makeRequest({ email_friend_request: false, email_card_resolved: false }),
      { params },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    // The merge keeps existing keys + applies new ones
    expect(body.notificationPreferences).toEqual({
      email_card_resolved: false,
      friend_request: true,
      email_friend_request: false,
    });
    // Update was called once with the merged payload
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0] as {
      notification_preferences: Record<string, boolean>;
    };
    expect(payload.notification_preferences.email_card_resolved).toBe(false);
    expect(payload.notification_preferences.email_friend_request).toBe(false);
    expect(payload.notification_preferences.friend_request).toBe(true);
  });

  it("handles a null existing preferences row by starting from {}", async () => {
    asAdmin();
    fetchProfileResult = {
      data: {
        id: "u1",
        username: "alice",
        notification_preferences: null,
      },
      error: null,
    };

    const res = await PATCH(makeRequest({ email_friend_request: false }), {
      params,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notificationPreferences).toEqual({
      email_friend_request: false,
    });
  });

  it("returns 404 when the target user does not exist", async () => {
    asAdmin();
    fetchProfileResult = { data: null, error: { message: "no rows" } };

    const res = await PATCH(makeRequest({ email_friend_request: false }), {
      params,
    });

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 500 and logs when the DB update fails", async () => {
    asAdmin();
    updateError = { message: "db down" };

    const res = await PATCH(makeRequest({ email_friend_request: false }), {
      params,
    });

    expect(res.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("logs an audit line on successful update with the admin id and changed keys", async () => {
    asAdmin();

    await PATCH(
      makeRequest({ email_friend_request: false, email_card_resolved: false }),
      { params },
    );

    expect(mockLogInfo).toHaveBeenCalled();
    const auditCall = mockLogInfo.mock.calls.find((c) => c[0] === "admin-prefs");
    expect(auditCall).toBeDefined();
    const message = auditCall![1] as string;
    expect(message).toContain("admin-1");
    expect(message).toContain(validUuid);
    expect(message).toContain("email_friend_request");
    expect(message).toContain("email_card_resolved");
  });
});
