-- Convert email_allowlist (whitelist semantics) → email_blocklist (blacklist semantics).
--
-- Old model:
--   email_enabled.enabled controls global on/off
--   email_allowlist.value is a comma list of permitted addresses
--   email_allowlist.value = '*' means "send to everyone"
--   sendEmail logic: skip if recipient NOT in allowlist
--
-- New model:
--   email_enabled.enabled controls global on/off (unchanged)
--   email_blocklist.value is a comma list of BLOCKED addresses
--   email_blocklist.enabled controls whether the blocklist is enforced
--     (true = enforce, false = bypass — useful for emergency override)
--   sendEmail logic: skip if recipient IS in blocklist
--
-- Why: simpler mental model. Once email_enabled is on for everyone, the
-- blocklist is the right shape — you don't manage thousands of allowed
-- addresses, you manage the few you want to exclude. Also lets the admin
-- pre-emptively block known fake/dummy accounts before they receive their
-- first send.
--
-- Migration is in-place: rename the existing row, clear the '*' value, and
-- update the description. Idempotent — if the row already has the new key,
-- skip.

UPDATE feature_flags
SET
  key = 'email_blocklist',
  value = '',
  -- Force `enabled = true` because the old `email_allowlist` row may have
  -- been left in any state — the previous sendEmail code never read this
  -- field, so production environments could have it as `false`. Without
  -- this, the new `if (blocklistFlag?.enabled)` guard would silently
  -- bypass every blocklist entry on those environments.
  enabled = true,
  description = 'Comma-separated list of email addresses that will NEVER receive notifications. Combined with the auto-suppression of bounced/complained addresses from email_events. The flag''s `enabled` field controls whether this list is enforced.'
WHERE key = 'email_allowlist';

-- Safety: if the migration runs in an environment that never had the old
-- key, insert the new row directly so the app can read from it.
INSERT INTO feature_flags (key, value, enabled, flag_type, description)
SELECT
  'email_blocklist',
  '',
  true,
  'string_list',
  'Comma-separated list of email addresses that will NEVER receive notifications. Combined with the auto-suppression of bounced/complained addresses from email_events. The flag''s `enabled` field controls whether this list is enforced.'
WHERE NOT EXISTS (
  SELECT 1 FROM feature_flags WHERE key = 'email_blocklist'
);
