-- Stores bounce, complaint, and delivery events from Resend webhooks.
-- Used for operational monitoring and per-user email health lookups.
-- No user-facing access — service_role only.

-- ============================================================
-- 1. EMAIL EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS email_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       text        NOT NULL,
  email_to         text        NOT NULL,
  email_subject    text,
  resend_email_id  text        NOT NULL,
  payload          jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE email_events IS
  'Resend webhook events (bounce, complaint, delivery) for monitoring email health.';

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_email_events_type_created
  ON email_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_email_events_email_to
  ON email_events (email_to);

-- ============================================================
-- 3. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_events_select_service"
  ON email_events FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "email_events_insert_service"
  ON email_events FOR INSERT
  TO service_role
  WITH CHECK (true);
