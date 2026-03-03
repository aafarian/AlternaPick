-- Add 'dnp' to pick_result enum for players who Did Not Play.
-- DNP picks don't count toward hit rate -- they're voided.
ALTER TYPE pick_result ADD VALUE IF NOT EXISTS 'dnp';
