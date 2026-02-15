
-- Fix encrypt/decrypt functions to use schema-qualified pgcrypto functions
CREATE OR REPLACE FUNCTION public.encrypt_app_password(plain_password text, encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(plain_password, encryption_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_app_password(encrypted_password text, encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_password, 'base64'), encryption_key);
END;
$$;

-- Re-revoke execute from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.decrypt_app_password(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_app_password(text, text) FROM anon, authenticated;
