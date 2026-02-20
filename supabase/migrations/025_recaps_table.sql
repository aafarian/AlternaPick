-- 025: Recaps table for global daily analytics
-- Stores computed daily recap/callout data and per-user highlights.
-- Used by the daily recap notification system.

-- ============================================================
-- 1. ADD 'daily_recap' TO NOTIFICATIONS TYPE CHECK CONSTRAINT
-- ============================================================
-- The notifications.type column uses a CHECK constraint (not an enum).
-- We must drop the existing constraint and re-add it with the new value.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'friend_request',
    'friend_accepted',
    'challenge_received',
    'challenge_accepted',
    'challenge_resolved',
    'card_resolved',
    'daily_recap'
  ));

-- ============================================================
-- 2. RECAPS TABLE
-- ============================================================
-- Each row represents one day's computed recap data.
-- recap_data: global callouts (top performer, biggest upset, etc.)
-- personal_highlights: per-user highlights keyed by user_id

CREATE TABLE IF NOT EXISTS recaps (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recap_date          date        NOT NULL UNIQUE,
  recap_data          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  personal_highlights jsonb       NOT NULL DEFAULT '{}'::jsonb,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
-- Unique index on recap_date for fast lookups by date.
-- The UNIQUE column constraint already creates an index, but we
-- add a named one explicitly for clarity and consistent naming.

CREATE UNIQUE INDEX IF NOT EXISTS idx_recaps_recap_date
  ON recaps (recap_date);

-- ============================================================
-- 4. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE recaps ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read recaps (public daily data)
CREATE POLICY "recaps_select_authenticated"
  ON recaps FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role (server-side admin) can insert new recaps
CREATE POLICY "recaps_insert_service"
  ON recaps FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service_role (server-side admin) can update existing recaps
CREATE POLICY "recaps_update_service"
  ON recaps FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
