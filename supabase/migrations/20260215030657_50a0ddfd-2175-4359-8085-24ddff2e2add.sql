
-- Add global_settings jsonb column to profiles table
ALTER TABLE public.profiles
ADD COLUMN global_settings jsonb NOT NULL DEFAULT '{
  "theme": "system",
  "default_content_scope": "both",
  "default_batch_size": 5,
  "ai_strategy": "balanced",
  "strict_conflict_mode": true
}'::jsonb;
