-- =====================================================================
-- LiveConnect: Comprehensive Secure RLS Policies Update
-- =====================================================================

-- First, let's remove any "allow all" blanket policies that might exist
DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "conversations_all" ON public.conversations;
DROP POLICY IF EXISTS "conversation_members_all" ON public.conversation_members;
DROP POLICY IF EXISTS "messages_all" ON public.messages;
DROP POLICY IF EXISTS "message_reads_all" ON public.message_reads;
DROP POLICY IF EXISTS "user_activity_all" ON public.user_activity;
DROP POLICY IF EXISTS "calls_all" ON public.calls;
DROP POLICY IF EXISTS "call_participants_all" ON public.call_participants;
DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
DROP POLICY IF EXISTS "follows_all" ON public.follows;
DROP POLICY IF EXISTS "blocked_users_all" ON public.blocked_users;
DROP POLICY IF EXISTS "problem_reports_all" ON public.problem_reports;

-- Make sure RLS is actually enabled on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
-- Anyone can view profiles (needed for searching users)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. CALLS & PARTICIPANTS
-- You can only view calls you are a part of
DROP POLICY IF EXISTS "Users can view calls they participate in" ON public.calls;
CREATE POLICY "Users can view calls they participate in" ON public.calls FOR SELECT USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- You can only create calls if you are the caller
DROP POLICY IF EXISTS "Users can create calls where they are caller" ON public.calls;
CREATE POLICY "Users can create calls where they are caller" ON public.calls FOR INSERT WITH CHECK (caller_id = auth.uid());

-- You can only update call status if you are a participant
DROP POLICY IF EXISTS "Participants can update their call status" ON public.calls;
CREATE POLICY "Participants can update their call status" ON public.calls FOR UPDATE USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- 3. NOTIFICATIONS
-- You can only view your own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());

-- System can create notifications, users can trigger them via edge functions
-- Allowing authenticated users to create notifications for now to not break the app
DROP POLICY IF EXISTS "Users or system can insert notifications" ON public.notifications;
CREATE POLICY "Users or system can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- You can only update/mark as read your own notifications
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- You can only delete your own notifications
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- 4. MESSAGE READS
-- You can only view message reads for conversations you are in
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view message reads" ON public.message_reads FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid())
);

-- You can only mark messages as read for yourself
DROP POLICY IF EXISTS "Users can insert message reads" ON public.message_reads;
CREATE POLICY "Users can insert message reads" ON public.message_reads FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  conversation_id IN (SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid())
);
