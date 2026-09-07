import { Profile } from '@/src/types';

const PROFILES_CACHE_KEY = 'liveconnect_cached_profiles';
const FOLLOWS_CACHE_PREFIX = 'liveconnect_social_';

export function loadCachedProfiles(): Record<string, Profile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROFILES_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return {};
}

export function saveCachedProfile(profile?: Profile | null) {
  if (typeof window === 'undefined' || !profile?.id) return;
  try {
    const current = loadCachedProfiles();
    current[profile.id] = {
      ...current[profile.id],
      ...profile,
    };
    localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(current));
  } catch (e) {
    // ignore
  }
}

export function saveMultipleCachedProfiles(profiles: Profile[]) {
  if (typeof window === 'undefined' || !Array.isArray(profiles) || profiles.length === 0) return;
  try {
    const current = loadCachedProfiles();
    profiles.forEach((p) => {
      if (p?.id) {
        current[p.id] = {
          ...current[p.id],
          ...p,
        };
      }
    });
    localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(current));
  } catch (e) {
    // ignore
  }
}

export function loadLocalFollows(userId?: string): { following: string[]; followers: string[] } {
  if (typeof window === 'undefined' || !userId) return { following: [], followers: [] };
  try {
    const raw = localStorage.getItem(`${FOLLOWS_CACHE_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return { following: [], followers: [] };
}

export function saveLocalFollows(
  userId: string | undefined,
  data: { following: string[]; followers: string[] }
) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`${FOLLOWS_CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

const FOLLOWERS_LIST_PREFIX = 'liveconnect_followers_list_';
const FOLLOWING_LIST_PREFIX = 'liveconnect_following_list_';

export function loadCachedFollowersList(userId?: string): Profile[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(`${FOLLOWERS_LIST_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return [];
}

export function saveCachedFollowersList(userId: string | undefined, list: Profile[]) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(list)) return;
  try {
    localStorage.setItem(`${FOLLOWERS_LIST_PREFIX}${userId}`, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}

export function loadCachedFollowingList(userId?: string): Profile[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(`${FOLLOWING_LIST_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return [];
}

export function saveCachedFollowingList(userId: string | undefined, list: Profile[]) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(list)) return;
  try {
    localStorage.setItem(`${FOLLOWING_LIST_PREFIX}${userId}`, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}

