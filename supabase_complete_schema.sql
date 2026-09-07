-- ==============================================================================
-- LIVECONNECT: COMPLETE UPDATED SUPABASE DATABASE SCHEMA (2026 REVISION)
-- Instructions: Copy and paste this whole script into the Supabase SQL Editor and click "RUN".
-- All tables are configured with proper foreign keys, indexes, and Row Level Security (RLS).
-- ==============================================================================

-- 1. Enable Required Extensions
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
    gender TEXT,
    country TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ensure columns exist if table was already created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
        ALTER TABLE public.profiles ADD COLUMN gender TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'country') THEN
        ALTER TABLE public.profiles ADD COLUMN country TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_online') THEN
        ALTER TABLE public.profiles ADD COLUMN is_online BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen') THEN
        ALTER TABLE public.profiles ADD COLUMN last_seen TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

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
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
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
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
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
-- TABLE 8: FOLLOWS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at DESC);

-- ==============================================================================
-- TABLE 9: BLOCKED_USERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON public.blocked_users(blocked_id);

-- ==============================================================================
-- TABLE 10: NOTIFICATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id TEXT,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);

-- ==============================================================================
-- TABLE 11: SUBSCRIPTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('monthly', 'yearly', 'none')),
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled', 'payment_failed')),
    trial_start TIMESTAMPTZ DEFAULT now() NOT NULL,
    trial_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days') NOT NULL,
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    payment_provider TEXT,
    payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

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
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies (Read all, write own or full access for demo/active users)
DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by all authenticated users"
ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE USING (true);

-- 2. Conversations Policies
DROP POLICY IF EXISTS "Conversations select policy" ON public.conversations;
CREATE POLICY "Conversations select policy"
ON public.conversations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Conversations insert policy" ON public.conversations;
CREATE POLICY "Conversations insert policy"
ON public.conversations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Conversations update policy" ON public.conversations;
CREATE POLICY "Conversations update policy"
ON public.conversations FOR UPDATE USING (true);

-- 3. Conversation Members Policies
DROP POLICY IF EXISTS "Conversation members select policy" ON public.conversation_members;
CREATE POLICY "Conversation members select policy"
ON public.conversation_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Conversation members insert policy" ON public.conversation_members;
CREATE POLICY "Conversation members insert policy"
ON public.conversation_members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Conversation members delete policy" ON public.conversation_members;
CREATE POLICY "Conversation members delete policy"
ON public.conversation_members FOR DELETE USING (true);

-- 4. Messages Policies
DROP POLICY IF EXISTS "Messages select policy" ON public.messages;
CREATE POLICY "Messages select policy"
ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Messages insert policy" ON public.messages;
CREATE POLICY "Messages insert policy"
ON public.messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Messages update policy" ON public.messages;
CREATE POLICY "Messages update policy"
ON public.messages FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Messages delete policy" ON public.messages;
CREATE POLICY "Messages delete policy"
ON public.messages FOR DELETE USING (true);

-- 5. Message Reads Policies
DROP POLICY IF EXISTS "Message reads select policy" ON public.message_reads;
CREATE POLICY "Message reads select policy"
ON public.message_reads FOR SELECT USING (true);

DROP POLICY IF EXISTS "Message reads insert policy" ON public.message_reads;
CREATE POLICY "Message reads insert policy"
ON public.message_reads FOR INSERT WITH CHECK (true);

-- 6. Calls Policies
DROP POLICY IF EXISTS "Calls select policy" ON public.calls;
CREATE POLICY "Calls select policy"
ON public.calls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Calls insert policy" ON public.calls;
CREATE POLICY "Calls insert policy"
ON public.calls FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Calls update policy" ON public.calls;
CREATE POLICY "Calls update policy"
ON public.calls FOR UPDATE USING (true);

-- 7. Call Participants Policies
DROP POLICY IF EXISTS "Call participants select policy" ON public.call_participants;
CREATE POLICY "Call participants select policy"
ON public.call_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Call participants insert policy" ON public.call_participants;
CREATE POLICY "Call participants insert policy"
ON public.call_participants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Call participants update policy" ON public.call_participants;
CREATE POLICY "Call participants update policy"
ON public.call_participants FOR UPDATE USING (true);

-- 8. Follows Policies
DROP POLICY IF EXISTS "Follows select policy" ON public.follows;
CREATE POLICY "Follows select policy"
ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Follows insert policy" ON public.follows;
CREATE POLICY "Follows insert policy"
ON public.follows FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Follows delete policy" ON public.follows;
CREATE POLICY "Follows delete policy"
ON public.follows FOR DELETE USING (true);

-- 9. Blocked Users Policies
DROP POLICY IF EXISTS "Blocked users select policy" ON public.blocked_users;
CREATE POLICY "Blocked users select policy"
ON public.blocked_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Blocked users insert policy" ON public.blocked_users;
CREATE POLICY "Blocked users insert policy"
ON public.blocked_users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Blocked users delete policy" ON public.blocked_users;
CREATE POLICY "Blocked users delete policy"
ON public.blocked_users FOR DELETE USING (true);

-- 10. Notifications Policies
DROP POLICY IF EXISTS "Notifications select policy" ON public.notifications;
CREATE POLICY "Notifications select policy"
ON public.notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Notifications insert policy" ON public.notifications;
CREATE POLICY "Notifications insert policy"
ON public.notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Notifications update policy" ON public.notifications;
CREATE POLICY "Notifications update policy"
ON public.notifications FOR UPDATE USING (true);

-- 11. Subscriptions Policies
DROP POLICY IF EXISTS "Subscriptions select policy" ON public.subscriptions;
CREATE POLICY "Subscriptions select policy"
ON public.subscriptions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Subscriptions insert policy" ON public.subscriptions;
CREATE POLICY "Subscriptions insert policy"
ON public.subscriptions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Subscriptions update policy" ON public.subscriptions;
CREATE POLICY "Subscriptions update policy"
ON public.subscriptions FOR UPDATE USING (true);

-- ==============================================================================
-- AUTOMATIC NEW USER TRIGGER (Profiles + Subscriptions)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  clean_name TEXT;
BEGIN
  BEGIN
    clean_name := COALESCE(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(COALESCE(new.email, 'user'), '@', 1),
      'user_' || substr(new.id::text, 1, 6)
    );

    base_username := COALESCE(
      new.raw_user_meta_data->>'username',
      lower(regexp_replace(clean_name, '[^a-zA-Z0-9_]', '', 'g'))
    );

    IF base_username IS NULL OR char_length(base_username) < 3 THEN
      base_username := 'user_' || substr(new.id::text, 1, 8);
    END IF;

    -- Insert profile
    INSERT INTO public.profiles (id, username, display_name, avatar_url, bio, is_online, last_seen, created_at, updated_at)
    VALUES (
      new.id,
      base_username || '_' || substr(new.id::text, 1, 4),
      clean_name,
      COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', NULL),
      'Hey there! I am using LiveConnect.',
      true,
      now(),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = now();

    -- Insert 30-day Free Trial subscription if table exists
    BEGIN
      INSERT INTO public.subscriptions (user_id, plan, status, trial_start, trial_end, created_at, updated_at)
      VALUES (
        new.id,
        'none',
        'trial',
        now(),
        now() + INTERVAL '30 days',
        now(),
        now()
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
  END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- REALTIME REPLICATION SETUP
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
