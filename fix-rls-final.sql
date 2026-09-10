-- Check policies for remaining tables: problem_reports, user_activity, subscriptions, calling_ad_rewards, user_calling_credits

-- Ensure RLS is enabled for all remaining tables
ALTER TABLE IF EXISTS public.problem_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. PROBLEM REPORTS
DROP POLICY IF EXISTS "Users can insert problem reports" ON public.problem_reports;
DROP POLICY IF EXISTS "Users can view their own problem reports" ON public.problem_reports;

CREATE POLICY "Users can insert problem reports" ON public.problem_reports 
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own problem reports" ON public.problem_reports 
FOR SELECT USING (user_id = auth.uid());

-- 2. USER ACTIVITY (Online status/last seen)
DROP POLICY IF EXISTS "Anyone can view user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users can update their own activity" ON public.user_activity;

CREATE POLICY "Anyone can view user activity" ON public.user_activity 
FOR SELECT USING (true);

CREATE POLICY "Users can update their own activity" ON public.user_activity 
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can modify their own activity" ON public.user_activity 
FOR UPDATE USING (user_id = auth.uid());

-- 3. SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscriptions" ON public.subscriptions 
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions" ON public.subscriptions 
FOR UPDATE USING (user_id = auth.uid());

