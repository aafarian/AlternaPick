-- Phase 5: Notifications table, RLS, indexes, and share_token on cards

-- ============================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'friend_request',
    'friend_accepted',
    'challenge_received',
    'challenge_accepted',
    'challenge_resolved',
    'card_resolved'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX idx_notifications_user_read_created
  ON notifications (user_id, read, created_at DESC);

-- ============================================================
-- 3. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only update their own notifications (e.g., mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role (admin) can insert notifications on behalf of any user.
-- No INSERT policy for authenticated users — notifications are created server-side.

-- ============================================================
-- 4. SHARE TOKEN ON CARDS
-- ============================================================

ALTER TABLE cards ADD COLUMN share_token TEXT UNIQUE;
