
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure view for client-side reads (excludes password)
CREATE OR REPLACE VIEW public.sites_safe AS
SELECT id, user_id, site_name, base_url, username, seo_plugin, strict_mode, batch_size, created_at
FROM public.sites;

-- Enable RLS on the view is not possible, but we can revoke direct table access
-- and grant access only through the view for anon/authenticated roles

-- Create a function to encrypt passwords (called from edge functions only)
CREATE OR REPLACE FUNCTION public.encrypt_app_password(plain_password text, encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(plain_password, encryption_key), 'base64');
END;
$$;

-- Create a function to decrypt passwords (called from edge functions only)  
CREATE OR REPLACE FUNCTION public.decrypt_app_password(encrypted_password text, encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_password, 'base64'), encryption_key);
END;
$$;

-- Revoke direct execute on decrypt from anon and authenticated (only service role should use it)
REVOKE EXECUTE ON FUNCTION public.decrypt_app_password(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_app_password(text, text) FROM anon, authenticated;
