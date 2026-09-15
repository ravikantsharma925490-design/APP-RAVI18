-- ==============================================================================
-- LIVECONNECT: BACKBLAZE B2 MEDIA METADATA COLUMNS MIGRATION
-- ==============================================================================

-- 1. Add Backblaze B2 metadata columns to profiles table if missing
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS b2_file_id TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS b2_file_name TEXT;

-- 2. Add Backblaze B2 metadata columns to messages table if missing
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS b2_file_id TEXT;
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS b2_file_name TEXT;
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- 3. Ensure RLS policies remain enabled
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
