import { createHmac, timingSafeEqual } from "crypto";
import { baseUrl } from "@/lib/email/styles";

/**
 * HMAC-SHA256 token for one-click unsubscribe.
 *
 * The token encodes the user's email so the unsubscribe endpoint can
 * identify the user without requiring authentication (email clients
 * POST the unsubscribe request directly).
 */

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.RESEND_API_KEY;
  if (!secret) throw new Error("No UNSUBSCRIBE_SECRET or RESEND_API_KEY");
  return secret;
}

/** Create a signed token for the given email address. */
export function createUnsubscribeToken(email: string): string {
  const normalised = email.toLowerCase().trim();
  const hmac = createHmac("sha256", getSecret()).update(normalised).digest("hex");
  // token = base64url(email):hmac
  const payload = Buffer.from(normalised).toString("base64url");
  return `${payload}.${hmac}`;
}

/** Verify a token and return the email it represents, or null if invalid. */
export function verifyUnsubscribeToken(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const providedHmac = token.slice(dotIndex + 1);

  let email: string;
  try {
    email = Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const expectedHmac = createHmac("sha256", getSecret()).update(email).digest("hex");

  // Timing-safe comparison
  const a = Buffer.from(providedHmac, "utf-8");
  const b = Buffer.from(expectedHmac, "utf-8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return email;
}

/** Build the full unsubscribe URL for a given email address. */
export function getUnsubscribeUrl(email: string): string {
  const token = createUnsubscribeToken(email);
  return `${baseUrl}/api/email/unsubscribe?token=${token}`;
}
