import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { logError, logInfo, logWarn } from "@/lib/logger";

const ENDPOINT = "/api/webhooks/resend";

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    to: string[];
    subject?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logError("email", "RESEND_WEBHOOK_SECRET is not configured", ENDPOINT);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const body = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  let payload: ResendWebhookPayload;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch (err) {
    logWarn("email", "Resend webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = payload.type;
  const emailTo = payload.data.to?.[0] ?? "unknown";

  if (eventType === "email.bounced" || eventType === "email.complained") {
    logWarn("email", `Resend ${eventType}: ${payload.data.email_id}`);
  } else {
    logInfo("email", `Resend ${eventType}: ${payload.data.email_id}`);
  }

  const admin = createAdminClient();
  const { error } = await typedFrom(admin, "email_events")
    .upsert(
      {
        event_type: eventType,
        email_to: emailTo,
        email_subject: payload.data.subject ?? null,
        resend_email_id: payload.data.email_id,
        payload: payload as unknown as Record<string, unknown>,
      },
      { onConflict: "resend_email_id", ignoreDuplicates: true },
    );

  if (error) {
    logError("email", "Failed to store email event", ENDPOINT, error);
    return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
