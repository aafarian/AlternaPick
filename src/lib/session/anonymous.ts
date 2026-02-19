export const ANON_SESSION_KEY = "ap_anon_id";

/** 30-day cookie expiry (seconds) */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function syncCookie(id: string) {
  document.cookie = `${ANON_SESSION_KEY}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getAnonymousId(): string {
  if (typeof window === "undefined") {
    throw new Error("getAnonymousId() cannot be called during SSR");
  }

  const existing = localStorage.getItem(ANON_SESSION_KEY);
  if (existing) {
    // Keep cookie in sync so server actions / OAuth callback can read it
    syncCookie(existing);
    return existing;
  }

  const id = crypto.randomUUID();
  localStorage.setItem(ANON_SESSION_KEY, id);
  syncCookie(id);
  return id;
}

export function clearAnonymousId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ANON_SESSION_KEY);
  document.cookie = `${ANON_SESSION_KEY}=; path=/; max-age=0`;
}
