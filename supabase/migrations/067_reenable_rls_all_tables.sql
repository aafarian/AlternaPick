-- Re-enable RLS on credit_log.
-- This table had RLS disabled (likely toggled off in the dashboard).
-- Service_role policies already exist from migration 040.
ALTER TABLE public.credit_log ENABLE ROW LEVEL SECURITY;
