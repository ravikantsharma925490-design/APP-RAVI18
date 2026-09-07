-- ==============================================================================
-- LIVECONNECT: COMPLETE ROW LEVEL SECURITY (RLS) POLICIES
-- Paste this script into your Supabase SQL Editor and click "RUN"
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calling_ad_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_calling_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.problem_reports ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() = id);

-- 3. Social Relations (Follows & Blocked)
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can view their blocked relations" ON public.blocked_users;
CREATE POLICY "Users can view their blocked relations" ON public.blocked_users FOR SELECT TO authenticated USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS "Users can block other users" ON public.blocked_users;
CREATE POLICY "Users can block other users" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocker_id <> blocked_id);

DROP POLICY IF EXISTS "Users can unblock users they blocked" ON public.blocked_users;
CREATE POLICY "Users can unblock users they blocked" ON public.blocked_users FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- 4. Messaging Policies
DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
CREATE POLICY "Users can view conversations" ON public.conversations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
CREATE POLICY "Users can view conversation members" ON public.conversation_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert conversation members" ON public.conversation_members;
CREATE POLICY "Users can insert conversation members" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages" ON public.messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view message reads" ON public.message_reads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert message reads" ON public.message_reads;
CREATE POLICY "Users can insert message reads" ON public.message_reads FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Calls Policies
DROP POLICY IF EXISTS "Users can view calls they participate in" ON public.calls;
CREATE POLICY "Users can view calls they participate in" ON public.calls FOR SELECT TO authenticated USING (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "Users can create calls where they are caller" ON public.calls;
CREATE POLICY "Users can create calls where they are caller" ON public.calls FOR INSERT TO authenticated WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update their call status" ON public.calls;
CREATE POLICY "Participants can update their call status" ON public.calls FOR UPDATE TO authenticated USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- 6. Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users or system can insert notifications" ON public.notifications;
CREATE POLICY "Users or system can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 7. Realtime Publication Setup
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.calls; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.follows; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
