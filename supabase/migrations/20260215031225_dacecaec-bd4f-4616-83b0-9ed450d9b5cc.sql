
-- Drop the security definer view (flagged by linter)
DROP VIEW IF EXISTS public.sites_safe;

-- Instead, revoke SELECT on the password column from authenticated/anon
-- Postgres doesn't support column-level RLS, but we can use column-level GRANT/REVOKE
-- First revoke all on the table, then grant back only safe columns

REVOKE SELECT ON public.sites FROM authenticated, anon;

GRANT SELECT (id, user_id, site_name, base_url, username, seo_plugin, strict_mode, batch_size, created_at) 
ON public.sites TO authenticated;

-- Keep INSERT/UPDATE/DELETE as-is (RLS still applies)
GRANT INSERT, UPDATE, DELETE ON public.sites TO authenticated;
