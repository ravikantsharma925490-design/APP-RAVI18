import React, { useState } from 'react';
import {
  KeyRound,
  Database,
  Video,
  Copy,
  Check,
  ExternalLink,
  X,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from '@/src/lib/supabase/client';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, onConfigUpdated }) => {
  const currentSupa = getSupabaseConfig();

  const [supabaseUrl, setSupabaseUrl] = useState(currentSupa.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentSupa.anonKey);

  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'sql'>('credentials');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onConfigUpdated();
      onClose();
    }, 800);
  };

  const handleClear = () => {
    if (confirm('Clear custom Supabase credentials and revert to environment defaults?')) {
      clearSupabaseConfig();
      setSupabaseUrl('');
      setSupabaseAnonKey('');
      onConfigUpdated();
    }
  };

  const sqlSchemaText = `-- Copy and paste this directly into your Supabase Dashboard SQL Editor
-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    country TEXT DEFAULT 'India',
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';

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

-- 4. Messages
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

-- 6. Calls
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

-- 7. Call Participants
CREATE TABLE IF NOT EXISTS public.call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    left_at TIMESTAMPTZ,
    UNIQUE (call_id, user_id)
);

-- 8. Notifications
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

-- 9. Follows
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (follower_id, following_id)
);

-- 10. Blocked Users
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (blocker_id, blocked_id)
);

-- 11. Problem Reports
CREATE TABLE IF NOT EXISTS public.problem_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. User OTPs (for OTP Email & DB Storage)
CREATE TABLE IF NOT EXISTS public.user_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    type TEXT DEFAULT 'signup',
    verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS and Realtime
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
ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for user_otps" ON public.user_otps;
CREATE POLICY "Allow all for user_otps" ON public.user_otps FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.user_otps TO anon, authenticated, service_role;

-- Add RLS Policies for full access to authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
CREATE POLICY "Users can view conversations" ON public.conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations" ON public.conversations FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
CREATE POLICY "Users can view conversation members" ON public.conversation_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert conversation members" ON public.conversation_members;
CREATE POLICY "Users can insert conversation members" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages" ON public.messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
CREATE POLICY "Users can delete messages" ON public.messages FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view message reads" ON public.message_reads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert message reads" ON public.message_reads;
CREATE POLICY "Users can insert message reads" ON public.message_reads FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete message reads" ON public.message_reads;
CREATE POLICY "Users can delete message reads" ON public.message_reads FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view calls" ON public.calls;
CREATE POLICY "Users can view calls" ON public.calls FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert calls" ON public.calls;
CREATE POLICY "Users can insert calls" ON public.calls FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update calls" ON public.calls;
CREATE POLICY "Users can update calls" ON public.calls FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view call participants" ON public.call_participants;
CREATE POLICY "Users can view call participants" ON public.call_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert call participants" ON public.call_participants;
CREATE POLICY "Users can insert call participants" ON public.call_participants FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update call participants" ON public.call_participants;
CREATE POLICY "Users can update call participants" ON public.call_participants FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
CREATE POLICY "Users can view notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update notifications" ON public.notifications;
CREATE POLICY "Users can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;
CREATE POLICY "Users can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view follows" ON public.follows;
CREATE POLICY "Users can view follows" ON public.follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage follows" ON public.follows;
CREATE POLICY "Users can manage follows" ON public.follows FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view blocked_users" ON public.blocked_users;
CREATE POLICY "Users can view blocked_users" ON public.blocked_users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage blocked_users" ON public.blocked_users;
CREATE POLICY "Users can manage blocked_users" ON public.blocked_users FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles, public.conversations, public.conversation_members, public.messages, public.message_reads, public.calls, public.call_participants, public.notifications, public.follows, public.blocked_users;

-- Safe Automatic User Creation Trigger (Fixes 'Database error saving new user')
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
        raw_username := COALESCE(
            NEW.raw_user_meta_data->>'username',
            split_part(NEW.email, '@', 1)
        );
        clean_username := regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g');
        IF char_length(clean_username) < 3 THEN
            clean_username := 'user_' || substr(md5(random()::text), 1, 6);
        END IF;
        base_username := clean_username;

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
            country,
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
            COALESCE(NEW.raw_user_meta_data->>'country', 'India'),
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
        RAISE WARNING 'handle_new_user notice: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Service Configuration
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Configure Supabase database connection credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6 bg-neutral-50/30 dark:bg-neutral-900/30 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-4 font-medium border-b-2 transition-colors ${
              activeTab === 'credentials'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            Supabase Credentials
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-4 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Database className="w-4 h-4" />
            Database SQL Migration
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'credentials' && (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Supabase Section */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>Supabase Project (PostgreSQL & Realtime)</span>
                  </div>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                  >
                    Supabase Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-3 py-2 text-base rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Supabase Anon Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    className="w-full px-3 py-2 text-base rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Direct WebRTC P2P Calling Info */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>1-to-1 WebRTC Calling (100% Direct & Free)</span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  1-to-1 audio and video calls connect directly between peers using end-to-end encrypted WebRTC. No external streaming servers or cloud media keys are required.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-neutral-500 hover:text-red-500 transition-colors"
                >
                  Reset to defaults
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                  >
                    {savedSuccess ? (
                      <>
                        <Check className="w-4 h-4" /> Saved!
                      </>
                    ) : (
                      'Save Credentials'
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Run this SQL in your Supabase project&apos;s SQL Editor to bootstrap all 7 tables, functions, triggers, RLS, and realtime publications.
                </p>
                <button
                  onClick={copySql}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0 shadow-sm"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy SQL
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-neutral-950 text-neutral-200 text-xs font-mono overflow-x-auto max-h-72 leading-relaxed border border-neutral-800">
                  {sqlSchemaText}
                </pre>
              </div>

              {/* Wipe / Clean Database SQL Snippet */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider">
                      Clean / Delete Test Data SQL
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Run this in Supabase SQL editor to delete all test messages, calls, and chat history.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const cleanSql = `TRUNCATE TABLE public.messages, public.message_reads, public.calls, public.call_participants, public.conversation_members, public.conversations CASCADE;`;
                      navigator.clipboard.writeText(cleanSql);
                      alert('Clean SQL copied to clipboard!');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-colors shrink-0"
                  >
                    Copy Clean SQL
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-neutral-950 text-red-400/90 text-[11px] font-mono overflow-x-auto border border-neutral-800">
                  TRUNCATE TABLE public.messages, public.message_reads, public.calls, public.call_participants, public.conversation_members, public.conversations CASCADE;
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
