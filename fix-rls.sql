-- =====================================================================
-- LiveConnect: Secure RLS Policies Update
-- =====================================================================

-- We need to drop the permissive policies on Messages and Conversations first
DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can insert conversation members" ON public.conversation_members;

DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;

-- 1. Conversation Members (Crucial for verifying access)
-- You can view members of conversations you are a part of
CREATE POLICY "Users can view conversation members" ON public.conversation_members 
FOR SELECT TO authenticated 
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

-- You can only add yourself or others to a conversation if you are creating it, 
-- or if you are already a member. For a 1-on-1 chat app, a simpler rule is:
-- A user can only insert members if they themselves are one of the members being inserted.
CREATE POLICY "Users can insert conversation members" ON public.conversation_members 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM public.conversation_members WHERE conversation_id = conversation_id));

-- 2. Conversations
-- You can only view conversations if you are a member of it
CREATE POLICY "Users can view conversations" ON public.conversations 
FOR SELECT TO authenticated 
USING (
  id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

-- Anyone can create a new conversation
CREATE POLICY "Users can create conversations" ON public.conversations 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 3. Messages
-- You can only read messages if you are a member of the conversation they belong to
CREATE POLICY "Users can view messages" ON public.messages 
FOR SELECT TO authenticated 
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

-- You can only send a message if:
-- 1. You are the sender (sender_id = auth.uid())
-- 2. You are a member of the conversation you are sending it to
CREATE POLICY "Users can insert messages" ON public.messages 
FOR INSERT TO authenticated 
WITH CHECK (
  sender_id = auth.uid() AND 
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

-- Message Deletion (If you want users to be able to delete their own messages)
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());
