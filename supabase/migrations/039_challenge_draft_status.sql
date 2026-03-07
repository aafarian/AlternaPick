-- Add "draft" status for mirror challenges created before props are selected
ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending';
