-- Phase 2: Make cards.user_id nullable
-- Auth is Phase 3; need to create cards without a logged-in user
ALTER TABLE cards ALTER COLUMN user_id DROP NOT NULL;
