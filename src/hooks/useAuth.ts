import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase, getSupabaseConfig } from '@/src/lib/supabase/client';
import { Profile } from '@/src/types';

// Helper: check if a username is available across the database
export async function checkUsernameAvailability(username: string, excludeUserId?: string): Promise<{
  available: boolean;
  message?: string;
}> {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanUsername || cleanUsername.length < 3) {
    return {
      available: false,
      message: 'Username must be at least 3 characters (letters, numbers, underscores only).',
    };
  }

  const { url, anonKey } = getSupabaseConfig();

  // 1. Check via authoritative Server API
  try {
    const res = await fetch('/api/auth/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        excludeUserId,
        supabaseUrl: url,
        supabaseAnonKey: anonKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.available === 'boolean') {
        return {
          available: data.available,
          message: data.message,
        };
      }
    }
  } catch (apiErr) {
    // continue to direct supabase query
  }

  // 2. Direct Supabase query fallback
  try {
    const supabase = getSupabase();

    // Check with RPC function first (SECURITY DEFINER bypasses RLS for unauthenticated users)
    try {
      const { data: isTaken, error: rpcErr } = await supabase.rpc('is_username_taken', {
        uname: cleanUsername,
      });
      if (!rpcErr && isTaken === true) {
        return {
          available: false,
          message: `✕ @${cleanUsername} is already taken. Please choose another.`,
        };
      }
    } catch (rpcEx) {
      // ignore
    }

    let query = supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return {
        available: false,
        message: `✕ @${cleanUsername} is already taken. Please choose another.`,
      };
    }

    return {
      available: true,
      message: `✓ @${cleanUsername} is available!`,
    };
  } catch (e: any) {
    return { available: true };
  }
}

// Helper: generate a guaranteed unique username suggestion
export async function generateUniqueUsernameSuggestion(baseHint?: string): Promise<string> {
  const cleanBase = (baseHint || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 10);
  const base = cleanBase.length >= 3 ? cleanBase : 'user';

  // 1. Try Server API for unique suggestion
  try {
    const res = await fetch('/api/auth/suggest-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHint: base }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.username) return data.username;
    }
  } catch (apiErr) {
    // continue to client candidate generation
  }

  // 2. Client candidate generation loop
  for (let i = 0; i < 8; i++) {
    const randomSuffix = Math.floor(100 + Math.random() * 9000);
    const candidate = `${base}_${randomSuffix}`;
    const check = await checkUsernameAvailability(candidate);
    if (check.available) {
      return candidate;
    }
  }
  return `${base}_${Date.now().toString().slice(-4)}`;
}

function loadCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('liveconnect_cached_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadCachedProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('liveconnect_cached_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(loadCachedUser);
  const [profile, setProfile] = useState<Profile | null>(loadCachedProfile);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem('liveconnect_cached_user');
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const updateProfileState = useCallback((newProf: Profile | null) => {
    setProfile(newProf);
    if (typeof window !== 'undefined') {
      if (newProf) {
        try {
          localStorage.setItem('liveconnect_cached_profile', JSON.stringify(newProf));
        } catch {}
      } else {
        try {
          localStorage.removeItem('liveconnect_cached_profile');
        } catch {}
      }
    }
  }, []);

  const updateUserState = useCallback((newUser: User | null) => {
    setUser(newUser);
    if (typeof window !== 'undefined') {
      if (newUser) {
        try {
          localStorage.setItem('liveconnect_cached_user', JSON.stringify(newUser));
        } catch {}
      } else {
        try {
          localStorage.removeItem('liveconnect_cached_user');
        } catch {}
      }
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string, currentUser?: User) => {
    const supabase = getSupabase();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist yet, create one with the user's exact chosen metadata
        if (currentUser) {
          const email = currentUser.email || '';
          const baseName = email.split('@')[0] || 'user';
          const chosenUsername = (
            currentUser.user_metadata?.username ||
            baseName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
          );
          
          const newProfile: Partial<Profile> = {
            id: userId,
            username: chosenUsername,
            display_name: (currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || baseName),
            avatar_url: currentUser.user_metadata?.avatar_url || null,
            bio: 'Hey there! I am using LiveConnect.',
            is_online: true,
            last_seen: new Date().toISOString(),
          };

          const { data: createdProfile } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select()
            .single();

          if (createdProfile) {
            updateProfileState(createdProfile as Profile);
            return;
          }
        }
      } else if (data) {
        updateProfileState(data as Profile);
      }
    } catch (err: any) {
      console.warn('Error fetching profile:', err.message);
    }
  }, [updateProfileState]);

  useEffect(() => {
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    // Check if current URL contains recovery hash parameters
    const checkRecoveryFromUrl = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        if (
          hash.includes('type=recovery') ||
          search.includes('type=recovery') ||
          hash.includes('type=recovery_token') ||
          (hash.includes('access_token=') && hash.includes('type=recovery'))
        ) {
          setIsPasswordRecovery(true);
          return true;
        }
      }
      return false;
    };

    checkRecoveryFromUrl();

    // Fast fallback safety timer to ensure UI never freezes on loading
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    // Check initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        updateUserState(initialSession?.user ?? null);
        if (checkRecoveryFromUrl()) {
          setIsPasswordRecovery(true);
        }
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id, initialSession.user);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Get session error:', err);
        setLoading(false);
      });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      updateUserState(newSession?.user ?? null);

      if (event === 'PASSWORD_RECOVERY' || checkRecoveryFromUrl()) {
        setIsPasswordRecovery(true);
      }

      if (newSession?.user) {
        await fetchProfile(newSession.user.id, newSession.user);
      } else {
        updateProfileState(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile, updateUserState, updateProfileState]);

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    username: string,
    country?: string
  ) => {
    setAuthError(null);
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured) {
      const err = new Error('Supabase is not configured yet. Please click the Settings gear icon (top-right) to enter your Supabase URL & Anon Key.');
      setAuthError(err.message);
      throw err;
    }

    const supabase = getSupabase();
    const cleanEmail = email.trim().toLowerCase();
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters (letters, numbers, underscores only).');
      }

      // Check if username already exists across all users
      try {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', cleanUsername)
          .limit(1);

        if (existingUser && existingUser.length > 0) {
          throw new Error(`Username "${cleanUsername}" is already taken by another user. Please choose a different username.`);
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes('already taken')) {
          throw checkErr;
        }
        console.warn('Username pre-check notice:', checkErr.message);
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

      let createdUserId: string | null = null;
      let usedServerApi = false;

      let serverOtpCode: string | null = null;

      try {
        const createRes = await fetch('/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            displayName: displayName.trim() || cleanUsername,
            username: cleanUsername,
            country: country || 'India',
          }),
        });
        
        const rawText = await createRes.text();
        let createResult: any = {};
        try {
          createResult = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
          console.warn('create-account parse notice:', e);
        }

        if (createRes.ok && createResult.success) {
          createdUserId = createResult.userId;
          usedServerApi = true;
          return { needsOtp: true, email: cleanEmail };
        } else if (createResult.error === 'FALLBACK_CLIENT_SIGNUP') {
          usedServerApi = false;
        } else if (createResult.error) {
          throw new Error(createResult.error);
        }
      } catch (srvErr: any) {
        if (srvErr.message && !srvErr.message.includes('FALLBACK_CLIENT_SIGNUP')) {
          throw srvErr;
        }
        console.warn('Server API create-account unavailable, using client fallback:', srvErr?.message);
      }

      if (!usedServerApi) {
        // Fallback to client-side Supabase signUp if Admin API service role key is not configured
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: origin,
            data: {
              display_name: displayName.trim() || cleanUsername,
              username: cleanUsername,
              country: country || 'India',
            },
          },
        });
        if (error) throw error;
        createdUserId = data.user?.id || null;
      }

      return { user: { id: createdUserId, email: cleanEmail } };
    } catch (err: any) {
      let msg = err.message || 'Failed to create account';
      if (msg.toLowerCase().includes('rate limit')) {
        // Automatically bypass email rate limit using Admin API
        setAuthError(null);
        try {
          const syncRes = await fetch('/api/auth/confirm-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password }),
          });
          const syncText = await syncRes.text();
          let syncData: any = {};
          if (syncText) { try { syncData = JSON.parse(syncText); } catch (e) {} }
          if (syncData?.session) {
            const { data: sessData } = await supabase.auth.setSession(syncData.session);
            if (sessData?.user) {
              await fetchProfile(sessData.user.id, sessData.user);
              return { user: { id: sessData.user.id, email: cleanEmail } };
            }
          }
        } catch (bErr) {
          console.warn('Rate limit admin bypass error:', bErr);
        }
      }
      if (msg.includes('Failed to fetch') || msg.includes('fetch failed') || msg.includes('NetworkError')) {
        msg = 'Network connection failed. Please check your Supabase Project URL in Settings.';
      } else if (msg.includes('Invalid API key') || msg.includes('JWT')) {
        msg = 'Invalid Supabase Anon Key. Please check the key in Settings & Configuration.';
      } else if (msg.includes('User already registered')) {
        msg = 'An account with this email already exists. Please Sign In instead.';
      } else if (msg.includes('Password should be at least')) {
        msg = 'Password is too short. Please use at least 6 characters.';
      } else if (msg.toLowerCase().includes('database error saving new user') || msg.toLowerCase().includes('database error')) {
        msg = 'Supabase Database Trigger Notice: Your Supabase database trigger failed during signup. Please open Settings (⚙️ icon) -> "SQL Schema" tab and copy/run the updated Safe Trigger SQL script in your Supabase SQL Editor.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const sendLoginOtp = async (email: string) => {
    setAuthError(null);
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured) {
      const err = new Error('Supabase is not configured yet. Please enter your Supabase URL & Key in Settings.');
      setAuthError(err.message);
      throw err;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Delegate OTP generation, DB insertion, and email dispatch to backend server (bypasses Supabase native rate limits)
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, type: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP code');
      }
      return data;
    } catch (err: any) {
      let msg = err.message || 'Failed to send OTP code';
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured) {
      const err = new Error('Supabase is not configured yet. Please click the Settings gear icon (top-right) to enter your Supabase URL & Anon Key.');
      setAuthError(err.message);
      throw err;
    }

    const supabase = getSupabase();
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (data.user) {
        await fetchProfile(data.user.id, data.user);
      }
      return data;
    } catch (err: any) {
      let msg = err.message || 'Failed to sign in';
      if (msg.includes('Email not confirmed') || msg.includes('Invalid login credentials') || msg.toLowerCase().includes('rate limit')) {
        // Auto-confirm email & sync password server-side via admin API and retry login automatically
        setAuthError(null);
        try {
          const syncRes = await fetch('/api/auth/confirm-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password }),
          });
          const syncText = await syncRes.text();
          let syncData: any = {};
          if (syncText) {
            try {
              syncData = JSON.parse(syncText);
            } catch (pErr) {
              console.warn('confirm-user JSON parse notice:', pErr);
            }
          }
          if (syncData?.success) {
            if (syncData.session) {
              const { data: sessData } = await supabase.auth.setSession(syncData.session);
              if (sessData?.user) {
                await fetchProfile(sessData.user.id, sessData.user);
                return sessData;
              }
            }
            const retryRes = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (retryRes.data?.user) {
              await fetchProfile(retryRes.data.user.id, retryRes.data.user);
              return retryRes.data;
            }
          }
        } catch (confirmErr) {
          console.warn('Auto-confirm retry notice:', confirmErr);
        }

        if (msg.includes('Invalid login credentials')) {
          msg = 'Invalid email or password. Please check your credentials and try again.';
        }
      } else if (msg.includes('Failed to fetch')) {
        msg = 'Unable to reach Supabase. Please verify your Supabase URL in Settings.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', user.id);
      } catch (e) {
        // ignore
      }
    }
    await supabase.auth.signOut();
    updateUserState(null);
    updateProfileState(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    const supabase = getSupabase();
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/#type=recovery`,
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send password reset email');
      throw err;
    }
  };

  const updatePassword = async (newPassword: string) => {
    setAuthError(null);
    const supabase = getSupabase();
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setIsPasswordRecovery(false);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update password');
      throw err;
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const supabase = getSupabase();
    try {
      if (updates.username) {
        const cleanUsername = updates.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (cleanUsername.length < 3) {
          throw new Error('Username must be at least 3 characters (letters, numbers, and underscores only).');
        }

        // If username changed, check if taken by anyone else
        if (profile && cleanUsername !== profile.username) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id, username')
            .ilike('username', cleanUsername)
            .neq('id', user.id)
            .limit(1);

          if (existingUser && existingUser.length > 0) {
            throw new Error(`Username "${cleanUsername}" is already taken by another user.`);
          }
        }
        updates.username = cleanUsername;
      }

      // 1. Update Auth User Metadata
      try {
        await supabase.auth.updateUser({
          data: {
            display_name: updates.display_name,
            username: updates.username,
            bio: updates.bio,
            gender: updates.gender,
            country: updates.country,
            avatar_url: updates.avatar_url,
          },
        });
      } catch (authMetaErr) {
        console.warn('Auth metadata update notice:', authMetaErr);
      }

      // 2. Try updating profiles table with full fields
      let updatedData: any = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select()
          .single();

        if (!error && data) {
          updatedData = data;
        } else if (error) {
          // If error is due to column not existing (e.g., gender or country in postgres), retry with basic fields
          const basicUpdates: Record<string, any> = {
            display_name: updates.display_name,
            username: updates.username,
            bio: updates.bio,
            updated_at: new Date().toISOString(),
          };
          if (updates.avatar_url !== undefined) basicUpdates.avatar_url = updates.avatar_url;

          const { data: retryData, error: retryError } = await supabase
            .from('profiles')
            .update(basicUpdates)
            .eq('id', user.id)
            .select()
            .single();

          if (!retryError && retryData) {
            updatedData = { ...retryData, gender: updates.gender, country: updates.country };
          }
        }
      } catch (tableErr) {
        console.warn('Profiles table update notice:', tableErr);
      }

      const mergedProfile: Profile = {
        ...(profile || {}),
        id: user.id,
        username: updates.username || profile?.username || 'user',
        display_name: updates.display_name || profile?.display_name || 'User',
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : (profile?.avatar_url || null),
        bio: updates.bio !== undefined ? updates.bio : (profile?.bio || null),
        gender: updates.gender !== undefined ? updates.gender : (profile?.gender || null),
        country: updates.country !== undefined ? updates.country : (profile?.country || null),
        is_online: profile?.is_online ?? true,
        last_seen: new Date().toISOString(),
        created_at: profile?.created_at || user.created_at,
        updated_at: new Date().toISOString(),
        ...(updatedData || {}),
      };

      setProfile(mergedProfile);
      return mergedProfile;
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update profile');
      throw err;
    }
  };

  // Dynamic profile fallback to ensure immediate responsiveness
  const effectiveProfile: Profile | null = profile || (user ? {
    id: user.id,
    username: (user.user_metadata?.username as string) || (user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : 'user'),
    display_name: (user.user_metadata?.display_name as string) || (user.user_metadata?.full_name as string) || (user.email ? user.email.split('@')[0] : 'User'),
    avatar_url: (user.user_metadata?.avatar_url as string) || null,
    bio: (user.user_metadata?.bio as string) || 'Hey there! I am using LiveConnect.',
    gender: (user.user_metadata?.gender as string) || null,
    country: (user.user_metadata?.country as string) || null,
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: user.created_at,
    updated_at: user.updated_at || new Date().toISOString(),
  } : null);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const { isConfigured } = getSupabaseConfig();
    if (!isConfigured) {
      const err = new Error('Supabase is not configured yet. Please enter your Supabase URL & Key in Settings.');
      setAuthError(err.message);
      throw err;
    }

    const supabase = getSupabase();
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
      return data;
    } catch (err: any) {
      let msg = err.message || 'Failed to sign in with Google';
      if (msg.toLowerCase().includes('provider is not enabled') || msg.toLowerCase().includes('unsupported provider')) {
        msg = 'Google Sign-In is not enabled in your Supabase Dashboard. Please enable Google provider under Authentication -> Providers in Supabase.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  return {
    user,
    profile: effectiveProfile,
    session,
    loading,
    authError,
    setAuthError,
    signUp,
    signIn,
    signInWithGoogle,
    sendLoginOtp,
    signOut,
    resetPassword,
    updatePassword,
    isPasswordRecovery,
    setIsPasswordRecovery,
    updateProfile,
    refreshProfile: () => user && fetchProfile(user.id, user),
  };
}
