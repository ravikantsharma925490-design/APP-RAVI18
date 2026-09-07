-- =====================================================================
-- LiveConnect: Rewarded Calling Credits & AdMob Reward System Migration
-- =====================================================================

-- 1. Table for tracking completed rewarded ads & awarded calling time
CREATE TABLE IF NOT EXISTS public.calling_ad_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reward_event_id TEXT NOT NULL,
    ads_completed INTEGER NOT NULL DEFAULT 3,
    calling_seconds INTEGER NOT NULL DEFAULT 120, -- 120 seconds = 2 minutes
    status TEXT NOT NULL CHECK (status IN ('active', 'consumed', 'expired')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '30 days') NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast user reward lookups
CREATE INDEX IF NOT EXISTS idx_calling_ad_rewards_user ON public.calling_ad_rewards(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calling_ad_rewards_event ON public.calling_ad_rewards(reward_event_id);

-- 2. Table for tracking running user calling credit balances & anti-abuse rate limits
CREATE TABLE IF NOT EXISTS public.user_calling_credits (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    completed_ads_in_cycle INTEGER NOT NULL DEFAULT 0 CHECK (completed_ads_in_cycle >= 0 AND completed_ads_in_cycle <= 3),
    total_ads_completed INTEGER NOT NULL DEFAULT 0,
    available_calling_seconds INTEGER NOT NULL DEFAULT 0,
    total_earned_seconds INTEGER NOT NULL DEFAULT 0,
    total_consumed_seconds INTEGER NOT NULL DEFAULT 0,
    last_ad_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Row Level Security (RLS) policies
ALTER TABLE public.calling_ad_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_calling_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own calling rewards
CREATE POLICY "Users can read own ad rewards"
    ON public.calling_ad_rewards
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can read their own calling credit balance
CREATE POLICY "Users can read own calling credits"
    ON public.user_calling_credits
    FOR SELECT
    USING (auth.uid() = user_id);
