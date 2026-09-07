-- ==============================================================================
-- LIVEKIT & SUPABASE REAL-TIME COMMUNICATION DATABASE SCHEMA
-- Compatible with Supabase PostgreSQL & Supabase Realtime
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- TABLE 1: PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT username_min_length CHECK (char_length(username) >= 3),
    CONSTRAINT username_valid_chars CHECK (username ~* '^[a-zA-Z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);

-- ==============================================================================
-- TABLE 2: CONVERSATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- ==============================================================================
-- TABLE 3: CONVERSATION_MEMBERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members(conversation_id);

-- ==============================================================================
-- TABLE 4: MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT message_content_not_empty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- ==============================================================================
-- TABLE 5: MESSAGE_READS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_user ON public.message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON public.message_reads(message_id);

-- ==============================================================================
-- TABLE 6: CALLS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
    status TEXT NOT NULL DEFAULT 'calling' CHECK (
        status IN ('calling', 'ringing', 'accepted', 'rejected', 'connected', 'ended', 'missed', 'cancelled', 'failed')
    ),
    room_name TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT caller_callee_different CHECK (caller_id <> callee_id)
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON public.calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_room_name ON public.calls(room_name);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON public.calls(created_at DESC);

-- ==============================================================================
-- TABLE 7: CALL_PARTICIPANTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    left_at TIMESTAMPTZ,
    UNIQUE (call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_participants_call ON public.call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user ON public.call_participants(user_id);

-- ==============================================================================
-- AUTOMATIC TIMESTAMPS TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_calls_updated_at ON public.calls;
CREATE TRIGGER set_calls_updated_at
    BEFORE UPDATE ON public.calls
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Update conversation updated_at when a new message is inserted
CREATE OR REPLACE FUNCTION public.handle_message_sent()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON public.messages;
CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_message_sent();

-- ==============================================================================
-- AUTHENTICATION HOOK: AUTOMATIC PROFILE CREATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_username TEXT;
    clean_username TEXT;
    base_username TEXT;
    counter INT := 0;
BEGIN
    BEGIN
        -- Extract username from metadata or email
        raw_username := COALESCE(
            NEW.raw_user_meta_data->>'username',
            split_part(NEW.email, '@', 1)
        );
        
        -- Clean characters
        clean_username := regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g');
        IF char_length(clean_username) < 3 THEN
            clean_username := 'user_' || substr(md5(random()::text), 1, 6);
        END IF;
        
        base_username := clean_username;
        
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) LOOP
            counter := counter + 1;
            clean_username := base_username || counter::text;
        END LOOP;

        INSERT INTO public.profiles (
            id,
            username,
            display_name,
            avatar_url,
            bio,
            is_online,
            last_seen,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            clean_username,
            COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
            COALESCE(NEW.raw_user_meta_data->>'bio', 'Hey there! I am using LiveConnect.'),
            false,
            now(),
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            updated_at = now();
    EXCEPTION WHEN OTHERS THEN
        -- Safely log warning without aborting auth.users account creation
        RAISE WARNING 'handle_new_user notice: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- HELPER FUNCTION: GET OR CREATE DIRECT CONVERSATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
    conv_id UUID;
    caller_id UUID := auth.uid();
BEGIN
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Self-chat support (Note to Self)
    IF caller_id = target_user_id THEN
        SELECT cm.conversation_id INTO conv_id
        FROM public.conversation_members cm
        JOIN public.conversations c ON c.id = cm.conversation_id
        WHERE c.type = 'direct'
          AND cm.user_id = caller_id
          AND (SELECT count(*) FROM public.conversation_members cm_sub WHERE cm_sub.conversation_id = cm.conversation_id) = 1
        LIMIT 1;

        IF conv_id IS NULL THEN
            INSERT INTO public.conversations (type) VALUES ('direct')
            RETURNING id INTO conv_id;

            INSERT INTO public.conversation_members (conversation_id, user_id)
            VALUES (conv_id, caller_id);
        END IF;

        RETURN conv_id;
    END IF;

    -- Find existing direct conversation with both members
    SELECT cm1.conversation_id INTO conv_id
    FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    JOIN public.conversations c ON c.id = cm1.conversation_id
    WHERE c.type = 'direct'
      AND cm1.user_id = caller_id
      AND cm2.user_id = target_user_id
    LIMIT 1;

    -- If none exists, create new conversation and add both users
    IF conv_id IS NULL THEN
        INSERT INTO public.conversations (type) VALUES ('direct')
        RETURNING id INTO conv_id;

        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES (conv_id, caller_id), (conv_id, target_user_id);
    END IF;

    RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- 2. Conversations Policies (Direct non-recursive access)
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;
DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
CREATE POLICY "Users can view conversations"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
    ON public.conversations FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update conversations they belong to" ON public.conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can delete conversations" ON public.conversations;
CREATE POLICY "Users can delete conversations"
    ON public.conversations FOR DELETE
    TO authenticated
    USING (true);

-- 3. Conversation Members Policies (Non-recursive access)
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
CREATE POLICY "Users can view conversation members"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can add members or join conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can insert conversation members" ON public.conversation_members;
CREATE POLICY "Users can insert conversation members"
    ON public.conversation_members FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete conversation members" ON public.conversation_members;
CREATE POLICY "Users can delete conversation members"
    ON public.conversation_members FOR DELETE
    TO authenticated
    USING (true);

-- 4. Messages Policies (Reliable non-recursive chat communication)
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert messages into their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
CREATE POLICY "Users can delete messages"
    ON public.messages FOR DELETE
    TO authenticated
    USING (true);

-- 5. Message Reads Policies
DROP POLICY IF EXISTS "Users can view read receipts for their conversations" ON public.message_reads;
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view message reads"
    ON public.message_reads FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_reads;
DROP POLICY IF EXISTS "Users can insert message reads" ON public.message_reads;
CREATE POLICY "Users can insert message reads"
    ON public.message_reads FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete message reads" ON public.message_reads;
CREATE POLICY "Users can delete message reads"
    ON public.message_reads FOR DELETE
    TO authenticated
    USING (true);

-- 6. Calls Policies
DROP POLICY IF EXISTS "Users can view calls they participate in" ON public.calls;
CREATE POLICY "Users can view calls they participate in"
    ON public.calls FOR SELECT
    TO authenticated
    USING (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "Users can create calls where they are caller" ON public.calls;
CREATE POLICY "Users can create calls where they are caller"
    ON public.calls FOR INSERT
    TO authenticated
    WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update their call status" ON public.calls;
CREATE POLICY "Participants can update their call status"
    ON public.calls FOR UPDATE
    TO authenticated
    USING (caller_id = auth.uid() OR callee_id = auth.uid())
    WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "Participants can delete their calls" ON public.calls;
CREATE POLICY "Participants can delete their calls"
    ON public.calls FOR DELETE
    TO authenticated
    USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- 7. Call Participants Policies
DROP POLICY IF EXISTS "Users can view call participants of their calls" ON public.call_participants;
CREATE POLICY "Users can view call participants of their calls"
    ON public.call_participants FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.calls
            WHERE calls.id = call_participants.call_id
            AND (calls.caller_id = auth.uid() OR calls.callee_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can record their participation" ON public.call_participants;
CREATE POLICY "Users can record their participation"
    ON public.call_participants FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own call participation record" ON public.call_participants;
CREATE POLICY "Users can update their own call participation record"
    ON public.call_participants FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- TABLE 8: PROBLEM_REPORTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_problem_reports_user ON public.problem_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_problem_reports_created_at ON public.problem_reports(created_at DESC);

ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert problem reports" ON public.problem_reports;
CREATE POLICY "Users can insert problem reports"
    ON public.problem_reports FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own problem reports" ON public.problem_reports;
CREATE POLICY "Users can view their own problem reports"
    ON public.problem_reports FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END
$$;
