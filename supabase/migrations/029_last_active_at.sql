-- Track last site visit for DAU metrics
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Backfill from latest card creation as a rough proxy
UPDATE profiles p
SET last_active_at = sub.latest
FROM (
  SELECT user_id, MAX(created_at) AS latest
  FROM cards
  GROUP BY user_id
) sub
WHERE p.id = sub.user_id
  AND p.last_active_at IS NULL;

-- Index for efficient DAU count queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON profiles (last_active_at);
