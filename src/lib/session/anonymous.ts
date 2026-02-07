export const ANON_SESSION_KEY = "st_anon_id";

export function getAnonymousId(): string {
  if (typeof window === "undefined") {
    throw new Error("getAnonymousId() cannot be called during SSR");
  }

  const existing = localStorage.getItem(ANON_SESSION_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(ANON_SESSION_KEY, id);
  return id;
}

export function clearAnonymousId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ANON_SESSION_KEY);
}
