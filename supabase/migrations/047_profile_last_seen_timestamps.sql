-- 047: Add last-seen timestamps for Analytics and Wrapped pages
-- Used to show "unseen data" indicator dots in the nav bar.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS analytics_last_seen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wrapped_last_seen_at timestamptz;
