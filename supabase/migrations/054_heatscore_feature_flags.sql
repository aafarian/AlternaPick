-- Add feature flags for HeatScore rollout.
--
-- heatscore_enabled: global on/off toggle (default: off)
-- heatscore_allowlist: comma-separated emails of beta users who see HeatScore
--   before GA rollout (default: empty, disabled)

INSERT INTO feature_flags (key, value, enabled, flag_type, description)
SELECT
  'heatscore_enabled',
  'false',
  false,
  'boolean',
  'Global toggle for HeatScore. When enabled, HeatScore is calculated on card resolution and the notch selector is visible to all users (or allowlisted users if heatscore_allowlist is also active).'
WHERE NOT EXISTS (
  SELECT 1 FROM feature_flags WHERE key = 'heatscore_enabled'
);

INSERT INTO feature_flags (key, value, enabled, flag_type, description)
SELECT
  'heatscore_allowlist',
  '',
  false,
  'string_list',
  'Comma-separated list of user emails who see HeatScore before GA rollout. Only consulted when heatscore_enabled is off — once the global flag is on, everyone has access.'
WHERE NOT EXISTS (
  SELECT 1 FROM feature_flags WHERE key = 'heatscore_allowlist'
);
