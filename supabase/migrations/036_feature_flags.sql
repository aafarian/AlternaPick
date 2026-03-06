-- 036: Feature flags table for runtime configuration
-- Stores feature flags with typed values, env var fallbacks, and per-flag toggles.
-- Used by the feature-flags module to resolve flags with DB-first, env var fallback.

-- ============================================================
-- 1. FEATURE FLAGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text        UNIQUE NOT NULL,
  value             text        NOT NULL DEFAULT '',
  flag_type         text        NOT NULL DEFAULT 'boolean',
  description       text        NOT NULL DEFAULT '',
  enabled           boolean     NOT NULL DEFAULT true,
  env_var_fallback  text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feature_flags_flag_type_check CHECK (
    flag_type IN ('boolean', 'string', 'string_list', 'number')
  )
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Index on key is already covered by the UNIQUE constraint above; no explicit index needed.

-- ============================================================
-- 3. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Only service_role can read feature flags (contains sensitive data like admin_emails)
CREATE POLICY "feature_flags_select_service"
  ON feature_flags FOR SELECT
  TO service_role
  USING (true);

-- Only service_role (server-side admin) can insert new flags
CREATE POLICY "feature_flags_insert_service"
  ON feature_flags FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service_role (server-side admin) can update existing flags
CREATE POLICY "feature_flags_update_service"
  ON feature_flags FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Only service_role (server-side admin) can delete flags
CREATE POLICY "feature_flags_delete_service"
  ON feature_flags FOR DELETE
  TO service_role
  USING (true);

-- ============================================================
-- 4. SEED INITIAL FLAGS
-- ============================================================

INSERT INTO feature_flags (key, value, flag_type, description, enabled, env_var_fallback)
VALUES
  (
    'email_allowlist',
    '',
    'string_list',
    'Comma-separated list of emails allowed to receive emails, or * for all',
    false,
    'EMAIL_ALLOWLIST'
  ),
  (
    'admin_emails',
    '',
    'string_list',
    'Comma-separated list of admin email addresses',
    false,
    'ADMIN_EMAILS'
  ),
  (
    'email_enabled',
    'true',
    'boolean',
    'Global toggle for all outbound email sending',
    true,
    NULL
  );
