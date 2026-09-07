-- ==============================================================================
-- SOCIAL RELATIONS (FOLLOW, UNFOLLOW, BLOCK/UNBLOCK) & NOTIFICATIONS MIGRATION
-- Compatible with Supabase PostgreSQL & Supabase Realtime
-- ==============================================================================

-- ==============================================================================
-- TABLE 1: FOLLOWS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT cannot_follow_self CHECK (follower_id <> following_id),
    UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at DESC);

-- ==============================================================================
-- TABLE 2: BLOCKED_USERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT cannot_block_self CHECK (blocker_id <> blocked_id),
    UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- ==============================================================================
-- TABLE 3: NOTIFICATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('follow', 'follow_back', 'message', 'call_audio', 'call_video')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id TEXT,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);

-- ==============================================================================
-- HELPER FUNCTIONS: MUTUAL FOLLOW & BLOCK CHECKS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.are_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.blocked_users
        WHERE (blocker_id = user_a AND blocked_id = user_b)
           OR (blocker_id = user_b AND blocked_id = user_a)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_mutual_follow(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF user_a IS NULL OR user_b IS NULL OR user_a = user_b THEN
        RETURN FALSE;
    END IF;

    -- Block check
    IF public.are_blocked(user_a, user_b) THEN
        RETURN FALSE;
    END IF;

    -- Mutual follow check: A follows B AND B follows A
    RETURN EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = user_a AND following_id = user_b
    ) AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = user_b AND following_id = user_a
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: When a block is inserted, immediately break follow relationships in both directions
CREATE OR REPLACE FUNCTION public.handle_user_blocked()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.follows
    WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
       OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_blocked ON public.blocked_users;
CREATE TRIGGER on_user_blocked
    AFTER INSERT ON public.blocked_users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_blocked();

-- Trigger: When User A follows User B, create a notification for User B
CREATE OR REPLACE FUNCTION public.handle_follow_created()
RETURNS TRIGGER AS $$
DECLARE
    actor_profile RECORD;
    is_reciprocal BOOLEAN := false;
BEGIN
    -- Check if target user has blocked actor or vice-versa
    IF public.are_blocked(NEW.follower_id, NEW.following_id) THEN
        RETURN NEW;
    END IF;

    -- Get actor details
    SELECT display_name, username INTO actor_profile
    FROM public.profiles
    WHERE id = NEW.follower_id;

    -- Check if target user was already following actor (meaning this follow creates mutual follow)
    SELECT EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = NEW.following_id AND following_id = NEW.follower_id
    ) INTO is_reciprocal;

    IF is_reciprocal THEN
        -- Reciprocal follow back notification
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            reference_id,
            is_read
        ) VALUES (
            NEW.following_id,
            NEW.follower_id,
            'follow_back',
            'Followed you back',
            COALESCE(actor_profile.display_name, actor_profile.username, 'Someone') || ' followed you back.',
            NEW.follower_id::TEXT,
            false
        );
    ELSE
        -- First follow notification
        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            reference_id,
            is_read
        ) VALUES (
            NEW.following_id,
            NEW.follower_id,
            'follow',
            'New follower',
            COALESCE(actor_profile.display_name, actor_profile.username, 'Someone') || ' started following you.',
            NEW.follower_id::TEXT,
            false
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
CREATE TRIGGER on_follow_created
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.handle_follow_created();

-- Trigger: When a message is sent, create notification for receiver if not blocked and mutual
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_user RECORD;
    actor_profile RECORD;
BEGIN
    -- Find the other member in this direct conversation
    SELECT user_id INTO target_user
    FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
    LIMIT 1;

    IF target_user.user_id IS NOT NULL THEN
        -- Check if blocked or mutual follow
        IF NOT public.are_blocked(NEW.sender_id, target_user.user_id) THEN
            SELECT display_name, username INTO actor_profile
            FROM public.profiles
            WHERE id = NEW.sender_id;

            INSERT INTO public.notifications (
                user_id,
                actor_id,
                type,
                title,
                message,
                reference_id,
                is_read
            ) VALUES (
                target_user.user_id,
                NEW.sender_id,
                'message',
                'New Message',
                'You have a new message from ' || COALESCE(actor_profile.display_name, actor_profile.username, 'User') || '.',
                NEW.conversation_id::TEXT,
                false
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created_notification ON public.messages;
CREATE TRIGGER on_message_created_notification
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_message_notification();

-- Trigger: When a call is initiated, create call notification for callee
CREATE OR REPLACE FUNCTION public.handle_call_notification()
RETURNS TRIGGER AS $$
DECLARE
    caller_profile RECORD;
BEGIN
    IF NOT public.are_blocked(NEW.caller_id, NEW.callee_id) THEN
        SELECT display_name, username INTO caller_profile
        FROM public.profiles
        WHERE id = NEW.caller_id;

        INSERT INTO public.notifications (
            user_id,
            actor_id,
            type,
            title,
            message,
            reference_id,
            is_read
        ) VALUES (
            NEW.callee_id,
            NEW.caller_id,
            CASE WHEN NEW.call_type = 'video' THEN 'call_video' ELSE 'call_audio' END,
            CASE WHEN NEW.call_type = 'video' THEN 'Incoming Video Call' ELSE 'Incoming Audio Call' END,
            'Incoming ' || NEW.call_type || ' call from ' || COALESCE(caller_profile.display_name, caller_profile.username, 'User') || '.',
            NEW.id::TEXT,
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_call_created_notification ON public.calls;
CREATE TRIGGER on_call_created_notification
    AFTER INSERT ON public.calls
    FOR EACH ROW EXECUTE FUNCTION public.handle_call_notification();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Follows Policies
DROP POLICY IF EXISTS "Follows are viewable by authenticated users" ON public.follows;
CREATE POLICY "Follows are viewable by authenticated users"
    ON public.follows FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
    ON public.follows FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = follower_id
        AND follower_id <> following_id
        AND NOT public.are_blocked(follower_id, following_id)
    );

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow"
    ON public.follows FOR DELETE
    TO authenticated
    USING (auth.uid() = follower_id);

-- 2. Blocked Users Policies
DROP POLICY IF EXISTS "Users can view their blocked relations" ON public.blocked_users;
CREATE POLICY "Users can view their blocked relations"
    ON public.blocked_users FOR SELECT
    TO authenticated
    USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS "Users can block other users" ON public.blocked_users;
CREATE POLICY "Users can block other users"
    ON public.blocked_users FOR INSERT
    TO authenticated
    WITH CHECK (blocker_id = auth.uid() AND blocker_id <> blocked_id);

DROP POLICY IF EXISTS "Users can unblock users they blocked" ON public.blocked_users;
CREATE POLICY "Users can unblock users they blocked"
    ON public.blocked_users FOR DELETE
    TO authenticated
    USING (blocker_id = auth.uid());

-- 3. Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users or system can insert notifications" ON public.notifications;
CREATE POLICY "Users or system can insert notifications"
    ON public.notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can delete their notifications"
    ON public.notifications FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END
$$;
