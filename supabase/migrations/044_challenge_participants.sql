-- Extends challenges for group lobbies (2–8 participants) and adds a
-- challenge_participants join table for per-participant status, placement,
-- and card tracking.

-- ============================================================
-- 1. ALTER CHALLENGES TABLE
-- ============================================================

-- Distinguishes 1v1 from group challenges
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS lobby_type text NOT NULL DEFAULT '1v1';

-- Maximum number of participants allowed in the challenge
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS max_participants int NOT NULL DEFAULT 2;

-- ============================================================
-- 2. CHALLENGE PARTICIPANTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS challenge_participants (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  uuid        NOT NULL REFERENCES challenges ON DELETE CASCADE,
  user_id       uuid        REFERENCES profiles,
  email         text,
  status        text        NOT NULL DEFAULT 'invited',
  card_id       uuid        REFERENCES cards,
  placement     int,
  score         int,
  is_creator    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE challenge_participants IS
  'Per-participant rows for group (and optionally 1v1) challenges. Tracks invite status, card link, and final placement.';

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id
  ON challenge_participants (challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id
  ON challenge_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_email
  ON challenge_participants (email);

-- ============================================================
-- 4. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_participants_select_service"
  ON challenge_participants FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "challenge_participants_insert_service"
  ON challenge_participants FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "challenge_participants_update_service"
  ON challenge_participants FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "challenge_participants_delete_service"
  ON challenge_participants FOR DELETE
  TO service_role
  USING (true);
