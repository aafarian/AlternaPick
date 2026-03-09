-- Add "draft" status for all challenges (created as draft until the challenger submits their card)
ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending';
