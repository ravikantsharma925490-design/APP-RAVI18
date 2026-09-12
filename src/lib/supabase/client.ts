import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration keys for local storage override or .env
const STORAGE_URL_KEY = 'liveconnect_supabase_url';
const STORAGE_KEY_KEY = 'liveconnect_supabase_anon_key';

function extractUrlFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(decoded);
      if (parsed?.ref && typeof parsed.ref === 'string') {
        return `https://${parsed.ref}.supabase.co`;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  let envUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slvojojyssepcarxlmfd.supabase.co') as string;
  let envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdm9qb2p5c3NlcGNhcnhsbWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTkzMTEsImV4cCI6MjEwMjQ5NTMxMX0.9ZVwwycoPtNKo7zQXgkuGnz4xBqnAfUvtHGb47rR0A8') as string;
  
  envUrl = envUrl ? envUrl.trim() : '';
  envKey = envKey ? envKey.trim() : '';

  const savedUrl = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_URL_KEY) || '').trim() : '';
  const savedKey = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_KEY) || '').trim() : '';

  if (savedUrl && !savedUrl.startsWith('http://') && !savedUrl.startsWith('https://')) {
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_URL_KEY);
  }

  let url = (savedUrl && (savedUrl.startsWith('http://') || savedUrl.startsWith('https://'))) ? savedUrl : envUrl;
  const anonKey = savedKey || envKey;

  // If URL is missing, invalid, or has a placeholder, auto-derive from anon key JWT ref
  if ((!url || (!url.startsWith('http://') && !url.startsWith('https://')) || url.includes('your-supabase-project') || url.includes('placeholder')) && anonKey) {
    const derivedUrl = extractUrlFromJwt(anonKey);
    url = derivedUrl || 'https://slvojojyssepcarxlmfd.supabase.co';
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://slvojojyssepcarxlmfd.supabase.co';
  }
  
  const isConfigured = Boolean(
    url && 
    anonKey && 
    (url.startsWith('https://') || url.startsWith('http://')) &&
    !url.includes('your-supabase-project') &&
    !url.includes('placeholder-project')
  );

  return { url, anonKey, isConfigured };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    // Trigger reset of cached client
    supabaseInstance = null;
  }
}

export function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
    supabaseInstance = null;
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  let targetUrl = isConfigured ? url : 'https://slvojojyssepcarxlmfd.supabase.co';
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://slvojojyssepcarxlmfd.supabase.co';
  }
  const targetKey = isConfigured ? anonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdm9qb2p5c3NlcGNhcnhsbWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTkzMTEsImV4cCI6MjEwMjQ5NTMxMX0.9ZVwwycoPtNKo7zQXgkuGnz4xBqnAfUvtHGb47rR0A8';

  try {
    supabaseInstance = createClient(targetUrl, targetKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.warn('Supabase client creation fallback:', err);
    supabaseInstance = createClient('https://slvojojyssepcarxlmfd.supabase.co', targetKey);
  }

  return supabaseInstance;
}

export const supabase = getSupabase();
