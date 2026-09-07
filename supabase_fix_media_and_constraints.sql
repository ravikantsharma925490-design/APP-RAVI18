-- ==============================================================================
-- LIVECONNECT: FIX MESSAGES CONTENT CONSTRAINT & STORAGE
-- ==============================================================================

-- 1. Remove length restrictions on messages.content so media payloads and URLs are safely accepted
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_content_max_length;
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_content_check;

-- Ensure messages.content column is of type TEXT without arbitrary character limit
ALTER TABLE IF EXISTS public.messages ALTER COLUMN content TYPE TEXT;

-- 2. Ensure RLS policies allow reading and sending messages
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Anyone authenticated can insert messages'
  ) THEN
    CREATE POLICY "Anyone authenticated can insert messages" 
    ON public.messages FOR INSERT 
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Anyone authenticated can view messages'
  ) THEN
    CREATE POLICY "Anyone authenticated can view messages" 
    ON public.messages FOR SELECT 
    USING (true);
  END IF;
END $$;
