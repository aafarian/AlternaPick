-- Make webhook event inserts idempotent — Resend retries on 5xx,
-- so the same event can arrive more than once.

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_resend_id
  ON email_events (resend_email_id);
