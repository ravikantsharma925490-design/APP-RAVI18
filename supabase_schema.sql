-- ==============================================================================
-- LIVECONNECT SUPABASE SCHEMA & POLICIES
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL DEFAULT 'direct',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Conversation Members
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (conversation_id, user_id)
);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Message Reads
CREATE TABLE IF NOT EXISTS public.message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (message_id, user_id)
);

-- 6. User Activity
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type TEXT DEFAULT 'message',
    messages_count INT DEFAULT 1,
    calls_count INT DEFAULT 0,
    audio_calls_count INT DEFAULT 0,
    video_calls_count INT DEFAULT 0,
    unique_users_interacted INT DEFAULT 1,
    profile_views INT DEFAULT 0,
    stories_posted INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    reactions_count INT DEFAULT 0,
    login_count INT DEFAULT 1,
    activity_score NUMERIC DEFAULT 0,
    points INT DEFAULT 0,
    streak INT DEFAULT 0,
    status TEXT DEFAULT 'active',
    last_active TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- In case user_activity already exists, add missing columns
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS activity_score NUMERIC DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS profile_views INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS messages_count INT DEFAULT 1;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS calls_count INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS audio_calls_count INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS video_calls_count INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS unique_users_interacted INT DEFAULT 1;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS stories_posted INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS posts_count INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS reactions_count INT DEFAULT 0;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 1;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'message';
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 7. Calls Table
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'calling',
    room_name TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. Call Participants
CREATE TABLE IF NOT EXISTS public.call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    left_at TIMESTAMPTZ,
    UNIQUE (call_id, user_id)
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. Follows Table
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (follower_id, following_id)
);

-- 11. Blocked Users Table
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (blocker_id, blocked_id)
);

-- 12. Problem Reports
CREATE TABLE IF NOT EXISTS public.problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

-- Add Permissions / RLS Policies
CREATE POLICY "profiles_all" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "conversations_all" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "conversation_members_all" ON public.conversation_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "messages_all" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "message_reads_all" ON public.message_reads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "user_activity_all" ON public.user_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "calls_all" ON public.calls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "call_participants_all" ON public.call_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_all" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "follows_all" ON public.follows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "blocked_users_all" ON public.blocked_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "problem_reports_all" ON public.problem_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles, public.conversations, public.conversation_members, public.messages, public.message_reads, public.calls, public.call_participants, public.notifications, public.follows, public.blocked_users;
