-- Restore table-level grants for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;

-- Create a secure view that excludes the encrypted password
CREATE OR REPLACE VIEW public.sites_safe
WITH (security_invoker = on) AS
SELECT id, user_id, site_name, base_url, username, seo_plugin, strict_mode, batch_size, created_at
FROM public.sites;

-- Grant access to the view
GRANT SELECT ON public.sites_safe TO authenticated;