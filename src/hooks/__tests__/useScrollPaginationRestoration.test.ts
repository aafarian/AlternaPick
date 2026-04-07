// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollPaginationRestoration } from "../useScrollPaginationRestoration";

// jsdom provides window + sessionStorage. Stub scrollTo + rAF.

beforeEach(() => {
  window.sessionStorage.clear();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  window.scrollTo = vi.fn();
  // jsdom's requestAnimationFrame queues — make it synchronous for tests
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useScrollPaginationRestoration", () => {
  it("returns null savedOffset when nothing is in sessionStorage", () => {
    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));
    expect(result.current.savedOffset).toBeNull();
  });

  it("reads saved state on mount but does not clear it until restoreScroll fires", () => {
    // Strict Mode double-mounts components in dev, so a read-and-clear in
    // the lazy initializer would consume the state on the first mount and
    // leave the second mount with nothing. Verify the state survives until
    // the consumer explicitly restores.
    window.sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollY: 500, offset: 40 }),
    );

    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));

    expect(result.current.savedOffset).toBe(40);
    // Still in storage after read
    expect(window.sessionStorage.getItem("test-key")).not.toBeNull();

    // Now restore — that's when we clear
    act(() => {
      result.current.restoreScroll();
    });
    expect(window.sessionStorage.getItem("test-key")).toBeNull();
  });

  it("a second hook instance can still read the saved state (Strict Mode safe)", () => {
    window.sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollY: 500, offset: 40 }),
    );

    const { result: first } = renderHook(() =>
      useScrollPaginationRestoration("test-key"),
    );
    expect(first.current.savedOffset).toBe(40);

    // Second mount (simulating Strict Mode's second pass) should also see it
    const { result: second } = renderHook(() =>
      useScrollPaginationRestoration("test-key"),
    );
    expect(second.current.savedOffset).toBe(40);
  });

  it("ignores malformed JSON", () => {
    window.sessionStorage.setItem("test-key", "not valid json");
    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));
    expect(result.current.savedOffset).toBeNull();
  });

  it("ignores state with missing fields", () => {
    window.sessionStorage.setItem("test-key", JSON.stringify({ scrollY: 500 }));
    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));
    expect(result.current.savedOffset).toBeNull();
  });

  it("caps savedOffset at MAX_RESTORE_ITEMS (200)", () => {
    window.sessionStorage.setItem(
      "test-key",
      JSON.stringify({ scrollY: 1000, offset: 5000 }),
    );
    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));
    expect(result.current.savedOffset).toBe(200);
  });

  it("saves state on unmount with the latest recorded offset and last-seen scrollY", () => {
    const { result, unmount } = renderHook(() =>
      useScrollPaginationRestoration("test-key"),
    );

    // Record some offsets
    act(() => {
      result.current.recordOffset(60);
    });
    // Simulate scrolling — fire a scroll event so the hook captures the value
    Object.defineProperty(window, "scrollY", { value: 800, configurable: true });
    window.dispatchEvent(new Event("scroll"));

    // Simulate Next.js scrolling to top of the new page BEFORE unmount —
    // the hook should still save the user's last-seen scroll, not 0
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    unmount();

    const saved = window.sessionStorage.getItem("test-key");
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!)).toEqual({ scrollY: 800, offset: 60 });
  });

  it("does not save on unmount if no offset was recorded", () => {
    const { unmount } = renderHook(() =>
      useScrollPaginationRestoration("test-key"),
    );
    // No recordOffset call
    unmount();
    expect(window.sessionStorage.getItem("test-key")).toBeNull();
  });

  it("restoreScroll calls window.scrollTo with the saved Y", () => {
    window.sessionStorage.setItem("test-key", JSON.stringify({ scrollY: 750, offset: 30 }));

    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));

    act(() => {
      result.current.restoreScroll();
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 750,
      behavior: "instant",
    });
  });

  it("restoreScroll only fires once (idempotent)", () => {
    window.sessionStorage.setItem("test-key", JSON.stringify({ scrollY: 750, offset: 30 }));

    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));

    act(() => {
      result.current.restoreScroll();
      result.current.restoreScroll();
      result.current.restoreScroll();
    });

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("restoreScroll is a no-op when there's no saved state", () => {
    const { result } = renderHook(() => useScrollPaginationRestoration("test-key"));

    act(() => {
      result.current.restoreScroll();
    });

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("different keys are isolated", () => {
    window.sessionStorage.setItem("key-a", JSON.stringify({ scrollY: 100, offset: 10 }));
    window.sessionStorage.setItem("key-b", JSON.stringify({ scrollY: 200, offset: 20 }));

    const { result: resultA } = renderHook(() =>
      useScrollPaginationRestoration("key-a"),
    );
    const { result: resultB } = renderHook(() =>
      useScrollPaginationRestoration("key-b"),
    );

    expect(resultA.current.savedOffset).toBe(10);
    expect(resultB.current.savedOffset).toBe(20);
  });

  it("an empty key still works (used to disable restoration on a page)", () => {
    // The challenges page passes "" when not on the history tab
    const { result } = renderHook(() => useScrollPaginationRestoration(""));
    expect(result.current.savedOffset).toBeNull();
  });
});
