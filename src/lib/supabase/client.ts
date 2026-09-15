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

const FALLBACK_URL = 'https://slvojojyssepcarxlmfd.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdm9qb2p5c3NlcGNhcnhsbWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTkzMTEsImV4cCI6MjEwMjQ5NTMxMX0.9ZVwwycoPtNKo7zQXgkuGnz4xBqnAfUvtHGb47rR0A8';

function sanitizeUrl(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/^["']|["']$/g, '');
}

function isValidHttpUrl(str?: string | null): boolean {
  const clean = sanitizeUrl(str);
  if (!clean) return false;
  try {
    const parsed = new URL(clean);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const rawEnvUrl = sanitizeUrl((import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '') as string);
  const rawEnvKey = sanitizeUrl((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '') as string);
  
  const envUrl = isValidHttpUrl(rawEnvUrl) ? rawEnvUrl : FALLBACK_URL;
  const envKey = rawEnvKey || FALLBACK_KEY;

  const savedUrl = sanitizeUrl(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) : '');
  const savedKey = sanitizeUrl(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : '');

  if (savedUrl && !isValidHttpUrl(savedUrl)) {
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_URL_KEY);
  }

  let url = isValidHttpUrl(savedUrl) ? savedUrl : envUrl;
  const anonKey = savedKey || envKey;

  // If URL is missing, invalid, or has a placeholder, auto-derive from anon key JWT ref
  if ((!isValidHttpUrl(url) || url.includes('your-supabase-project') || url.includes('placeholder')) && anonKey) {
    const derivedUrl = extractUrlFromJwt(anonKey);
    url = (derivedUrl && isValidHttpUrl(derivedUrl)) ? derivedUrl : FALLBACK_URL;
  }

  if (!isValidHttpUrl(url)) {
    url = FALLBACK_URL;
  }
  
  const isConfigured = Boolean(
    url && 
    anonKey && 
    isValidHttpUrl(url) &&
    !url.includes('your-supabase-project') &&
    !url.includes('placeholder-project')
  );

  return { url, anonKey, isConfigured };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    const cleanUrl = url.trim();
    if (isValidHttpUrl(cleanUrl)) {
      localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
    }
    if (anonKey.trim()) {
      localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    }
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
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { url, anonKey } = getSupabaseConfig();
  const targetUrl = isValidHttpUrl(url) ? url : FALLBACK_URL;
  const targetKey = anonKey || FALLBACK_KEY;

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
    supabaseInstance = createClient(FALLBACK_URL, FALLBACK_KEY);
  }

  return supabaseInstance;
}

export const supabase = getSupabase();
