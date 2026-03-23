-- Supports email-based challenge invites where the opponent may not have an account yet.
-- Adds opponent_email to challenges, makes opponent_id nullable, and creates
-- a guest_tokens table for secure invite link verification.

-- ============================================================
-- 1. ALTER CHALLENGES TABLE
-- ============================================================

-- Allow challenges to be created without an opponent account
ALTER TABLE challenges ALTER COLUMN opponent_id DROP NOT NULL;

-- Store the invited email address for guest invites
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS opponent_email text;

-- ============================================================
-- 2. GUEST TOKENS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS guest_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text        UNIQUE NOT NULL,
  challenge_id  uuid        NOT NULL REFERENCES challenges ON DELETE CASCADE,
  email         text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE guest_tokens IS
  'Secure tokens for email-based challenge invite links. Guests redeem tokens to claim challenges.';

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_guest_tokens_token
  ON guest_tokens (token);

CREATE INDEX IF NOT EXISTS idx_guest_tokens_email
  ON guest_tokens (email);

-- ============================================================
-- 4. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE guest_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_tokens_select_service"
  ON guest_tokens FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "guest_tokens_insert_service"
  ON guest_tokens FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "guest_tokens_update_service"
  ON guest_tokens FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
