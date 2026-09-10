import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { spawn } from 'child_process';
import { handleLiveApiRequest } from './src/lib/live/live-api-router';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Live Voice Room API Dispatcher
app.all('/api/live/*', async (req, res) => {
  try {
    const url = req.path;
    const method = req.method;
    const body = req.body;
    const result = await handleLiveApiRequest(url, method, body, serverSupabase);
    if (result) {
      return res.status(result.status).json(result.data);
    }
    return res.status(404).json({ error: 'Live endpoint not found' });
  } catch (err: any) {
    console.error('Error in /api/live handler:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// In-memory media store for images, voice notes, and attachments
interface MediaFileRecord {
  id: string;
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
  size: number;
  createdAt: string;
  mp3Buffer?: Buffer;
}
const mediaFilesStore = new Map<string, MediaFileRecord>();

// Transcode any incoming audio (WebM Opus, OGG, AAC, etc.) to 44.1kHz MP3 for universal playback across iOS, Safari, Chrome & Android
function transcodeAudioToMp3(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const ff = spawn('ffmpeg', [
        '-y',
        '-i', 'pipe:0',
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'mp3',
        'pipe:1',
      ]);

      const chunks: Buffer[] = [];
      ff.stdout.on('data', (chunk) => chunks.push(chunk));
      ff.stderr.on('data', () => {});
      ff.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`FFmpeg audio conversion exited with code ${code}`));
        }
      });
      ff.on('error', (err) => reject(err));

      ff.stdin.write(inputBuffer);
      ff.stdin.end();
    } catch (err) {
      reject(err);
    }
  });
}

// In-memory username cache for fast collision avoidance
const registeredUsernames = new Map<string, string>(); // lowercase_username -> userId

// In-memory social relations & notifications store
const followsStore = new Set<string>(); // "followerId:followingId" (UUIDs only)
const blockedStore = new Set<string>(); // "blockerId:blockedId" (UUIDs only)
const notificationsStore = new Map<string, any[]>(); // userId -> Notification[]
const serverProfilesStore = new Map<string, any>(); // userId -> Profile

// Server-side Supabase client initialization (if credentials available)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://slvojojyssepcarxlmfd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdm9qb2p5c3NlcGNhcnhsbWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTkzMTEsImV4cCI6MjEwMjQ5NTMxMX0.9ZVwwycoPtNKo7zQXgkuGnz4xBqnAfUvtHGb47rR0A8';

let serverSupabase: any = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    serverSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Preload all follows into memory
    serverSupabase
      .from('follows')
      .select('follower_id, following_id')
      .then(({ data }: any) => {
        if (Array.isArray(data)) {
          data.forEach((r: any) => {
            if (r.follower_id && r.following_id) {
              followsStore.add(`${r.follower_id}:${r.following_id}`);
            }
          });
        }
      })
      .catch(() => {});
  }
} catch (err) {
  console.warn('Server Supabase init notice:', err);
}

interface ServerMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  sender?: any;
  is_read?: boolean;
}

interface ServerConversation {
  id: string;
  type: 'direct' | 'group';
  member_ids: string[];
  members_meta?: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_message?: ServerMessage | null;
  unread_count?: number;
}

interface ServerCall {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'cancelled' | 'missed';
  room_name: string;
  caller?: any;
  created_at: string;
  updated_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
}

const serverConversationsStore = new Map<string, ServerConversation>(); // convId -> conv
const messagesServerStore = new Map<string, ServerMessage[]>(); // conversation_id -> messages[]
const callsServerStore = new Map<string, ServerCall>(); // call_id -> call
const deletedConversationsServerStore = new Set<string>(); // convId -> deleted set

function getDeterministicDirectConvId(userA: string, userB: string): string {
  const sorted = [userA || '', userB || ''].sort().join(':');
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5, h3 = 0x811c9dc5, h4 = 0x811c9dc5;
  for (let i = 0; i < sorted.length; i++) {
    const code = sorted.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 2246822507) >>> 0;
    h3 = Math.imul(h3 ^ ((code << 3) + i), 3266489909) >>> 0;
    h4 = Math.imul(h4 ^ ((code << 5) + i), 1597334677) >>> 0;
  }
  h1 = (Math.imul(h1 ^ (h3 >>> 15), 2246822507) ^ h4) >>> 0;
  h2 = (Math.imul(h2 ^ (h4 >>> 13), 3266489909) ^ h1) >>> 0;
  h3 = (Math.imul(h3 ^ (h1 >>> 16), 1597334677) ^ h2) >>> 0;
  h4 = (Math.imul(h4 ^ (h2 >>> 11), 2654435761) ^ h3) >>> 0;

  const hex1 = h1.toString(16).padStart(8, '0');
  const hex2 = (h2 & 0xffff).toString(16).padStart(4, '0');
  const hex3 = '4' + ((h2 >>> 16) & 0x0fff).toString(16).padStart(3, '0');
  const hex4 = (0x8 | ((h3 >>> 28) & 0x3)).toString(16) + (h3 & 0x0fff).toString(16).padStart(3, '0');
  const hex5 = h4.toString(16).padStart(8, '0') + ((h3 >>> 12) & 0xffff).toString(16).padStart(4, '0');

  return `${hex1}-${hex2}-${hex3}-${hex4}-${hex5}`.toLowerCase();
}

function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val) ? val : null;
}

function isBlocked(userA: string, userB: string): boolean {
  if (!userA || !userB) return false;
  return blockedStore.has(`${userA}:${userB}`) || blockedStore.has(`${userB}:${userA}`);
}

function isFollowing(followerId: string, followingId: string): boolean {
  if (!followerId || !followingId) return false;
  if (followsStore.has(`${followerId}:${followingId}`)) return true;
  
  // Also check profile usernames if known
  const pA = serverProfilesStore.get(followerId);
  const pB = serverProfilesStore.get(followingId);
  if (pA?.username && pB?.username) {
    if (followsStore.has(`${pA.username}:${pB.username}`)) return true;
  }
  if (pA?.username && followsStore.has(`${pA.username}:${followingId}`)) return true;
  if (pB?.username && followsStore.has(`${followerId}:${pB.username}`)) return true;
  return false;
}

function isMutualFollow(userA: string, userB: string): boolean {
  if (!userA || !userB || userA === userB) return false;
  if (isBlocked(userA, userB)) return false;
  return isFollowing(userA, userB) && isFollowing(userB, userA);
}

// Server-authoritative mutual follow check with DB RPC & table fallback
async function verifyMutualFollow(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false;
  if (isBlocked(userA, userB)) return false;

  let aFollowsB = isFollowing(userA, userB);
  let bFollowsA = isFollowing(userB, userA);

  // 1. Query Supabase DB if available to enrich in-memory store
  if (serverSupabase) {
    try {
      const [{ data: rowAtoB }, { data: rowBtoA }] = await Promise.all([
        serverSupabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', userA)
          .eq('following_id', userB)
          .maybeSingle(),
        serverSupabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', userB)
          .eq('following_id', userA)
          .maybeSingle(),
      ]);

      if (rowAtoB) {
        aFollowsB = true;
        followsStore.add(`${userA}:${userB}`);
      }
      if (rowBtoA) {
        bFollowsA = true;
        followsStore.add(`${userB}:${userA}`);
      }
    } catch (e) {
      // Keep in-memory values
    }
  }

  return aFollowsB && bFollowsA;
}

function getFollowCounts(userId: string) {
  let followersCount = 0;
  let followingCount = 0;
  const countedFollowers = new Set<string>();
  const countedFollowing = new Set<string>();

  const p = serverProfilesStore.get(userId);
  const uname = p?.username;

  for (const item of followsStore) {
    const [fId, tId] = item.split(':');
    if (!fId || !tId) continue;
    if (tId === userId || (uname && tId === uname)) {
      if (!countedFollowers.has(fId)) {
        countedFollowers.add(fId);
        followersCount++;
      }
    }
    if (fId === userId || (uname && fId === uname)) {
      if (!countedFollowing.has(tId)) {
        countedFollowing.add(tId);
        followingCount++;
      }
    }
  }
  return { followersCount, followingCount };
}

function addNotification(
  userId: string,
  actorId: string,
  type: string,
  title: string,
  message: string,
  referenceId?: string,
  actorMeta?: any
) {
  if (!userId || !actorId || userId === actorId) return;
  if (isBlocked(userId, actorId)) return;

  const validRefId = toUuidOrNull(referenceId) || toUuidOrNull(actorId) || null;

  const currentList = notificationsStore.get(userId) || [];

  // Avoid duplicate notification within 10 seconds for same actor and type
  const duplicate = currentList.find(
    (n) =>
      n.actor_id === actorId &&
      n.type === type &&
      Date.now() - new Date(n.created_at || 0).getTime() < 10000
  );
  if (duplicate) {
    duplicate.title = title;
    duplicate.message = message;
    duplicate.created_at = new Date().toISOString();
    return duplicate;
  }

  const newNotif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    actor_id: actorId,
    type,
    title,
    message,
    reference_id: validRefId,
    is_read: false,
    created_at: new Date().toISOString(),
    actor: actorMeta || { id: actorId, display_name: 'User', username: 'user' },
  };

  notificationsStore.set(userId, [newNotif, ...currentList.slice(0, 99)]);
  return newNotif;
}

// ----------------------------------------------------
// USERNAME UNIQUENESS & AVAILABILITY API
// ----------------------------------------------------

// 1. Check if a username is available across the database
app.post('/api/auth/check-username', async (req, res) => {
  try {
    const { username, excludeUserId, supabaseUrl, supabaseAnonKey } = req.body;
    if (!username) {
      return res.status(400).json({ available: false, message: 'Username is required' });
    }

    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) {
      return res.json({
        available: false,
        message: 'Username must be at least 3 characters (letters, numbers, underscores only).',
      });
    }

    // Check local memory cache first
    const cachedOwner = registeredUsernames.get(clean);
    if (cachedOwner && (!excludeUserId || cachedOwner !== excludeUserId)) {
      return res.json({
        available: false,
        message: `✕ @${clean} is already taken. Please choose another.`,
      });
    }

    // Use requested client or server client
    let activeClient = serverSupabase;
    if (supabaseUrl && supabaseAnonKey && (supabaseUrl !== SUPABASE_URL || supabaseAnonKey !== SUPABASE_ANON_KEY)) {
      try {
        activeClient = createClient(supabaseUrl, supabaseAnonKey);
      } catch (err) {
        // fallback
      }
    }

    // Query Supabase directly
    if (activeClient) {
      try {
        // Try RPC function first (bypasses RLS if defined as SECURITY DEFINER)
        try {
          const { data: isTaken, error: rpcErr } = await activeClient.rpc('is_username_taken', {
            uname: clean,
          });
          if (!rpcErr && isTaken === true) {
            registeredUsernames.set(clean, 'taken');
            return res.json({
              available: false,
              message: `✕ @${clean} is already taken. Please choose another.`,
            });
          }
        } catch (rpcEx) {
          // ignore if rpc not yet created
        }

        let query = activeClient
          .from('profiles')
          .select('id, username')
          .ilike('username', clean);

        if (excludeUserId) {
          query = query.neq('id', excludeUserId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          registeredUsernames.set(clean, data[0].id);
          return res.json({
            available: false,
            message: `✕ @${clean} is already taken. Please choose another.`,
          });
        }
      } catch (dbErr) {
        console.warn('Supabase username check notice:', dbErr);
      }
    }

    return res.json({
      available: true,
      message: `✓ @${clean} is available!`,
    });
  } catch (error: any) {
    return res.status(500).json({ available: false, message: error.message });
  }
});

// 2. Generate a guaranteed unique username suggestion
app.post('/api/auth/suggest-username', async (req, res) => {
  try {
    const { baseHint } = req.body;
    const cleanBase = (baseHint || 'user')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 10);
    const base = cleanBase.length >= 3 ? cleanBase : 'user';

    for (let i = 0; i < 12; i++) {
      const randomSuffix = Math.floor(100 + Math.random() * 9000);
      const candidate = `${base}_${randomSuffix}`;

      // Check if taken in cache
      if (registeredUsernames.has(candidate)) continue;

      // Check in Supabase
      if (serverSupabase) {
        try {
          const { data } = await serverSupabase
            .from('profiles')
            .select('id')
            .ilike('username', candidate)
            .limit(1);

          if (data && data.length > 0) {
            registeredUsernames.set(candidate, data[0].id);
            continue;
          }
        } catch (e) {
          // ignore
        }
      }

      return res.json({ username: candidate });
    }

    const fallback = `${base}_${Date.now().toString().slice(-4)}`;
    return res.json({ username: fallback });
  } catch (error: any) {
    return res.json({ username: `user_${Math.floor(1000 + Math.random() * 9000)}` });
  }
});

// 3. Claim / Register username on successful creation
app.post('/api/auth/claim-username', (req, res) => {
  try {
    const { username, userId } = req.body;
    if (username && userId) {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      registeredUsernames.set(clean, userId);
    }
    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: false });
  }
});

// ----------------------------------------------------
// SOCIAL RELATIONS & MUTUAL FOLLOW ENDPOINTS
// ----------------------------------------------------

// 1. Get Relation Status & Overview for a user
app.post('/api/relations/user-overview', async (req, res) => {
  try {
    const { userId, username } = req.body;
    if (!userId && !username) {
      return res.status(400).json({ error: 'userId or username is required' });
    }

    let targetId = userId || '';
    if (!targetId && username) {
      for (const [pId, prof] of serverProfilesStore.entries()) {
        if (prof?.username?.toLowerCase() === username.toLowerCase()) {
          targetId = pId;
          break;
        }
      }
    }

    let followingSet = new Set<string>();
    let followersSet = new Set<string>();

    const targetUname = username || (targetId ? serverProfilesStore.get(targetId)?.username : '');

    for (const item of followsStore) {
      const [fId, tId] = item.split(':');
      if (fId === targetId || (targetUname && fId === targetUname)) {
        if (tId) followingSet.add(tId);
      }
      if (tId === targetId || (targetUname && tId === targetUname)) {
        if (fId) followersSet.add(fId);
      }
    }

    if (serverSupabase && targetId) {
      try {
        const [{ data: dbFollowing }, { data: dbFollowers }] = await Promise.all([
          serverSupabase.from('follows').select('following_id').eq('follower_id', targetId),
          serverSupabase.from('follows').select('follower_id').eq('following_id', targetId),
        ]);

        if (Array.isArray(dbFollowing)) {
          dbFollowing.forEach((r: any) => {
            if (r.following_id) {
              followingSet.add(r.following_id);
              followsStore.add(`${targetId}:${r.following_id}`);
            }
          });
        }

        if (Array.isArray(dbFollowers)) {
          dbFollowers.forEach((r: any) => {
            if (r.follower_id) {
              followersSet.add(r.follower_id);
              followsStore.add(`${r.follower_id}:${targetId}`);
            }
          });
        }
      } catch (e) {
        // ignore db error fallback to memory
      }
    }

    const following = Array.from(followingSet);
    const followers = Array.from(followersSet);

    // Collect profile objects
    const allIds = Array.from(new Set([...following, ...followers]));
    const fetchedProfilesMap = new Map<string, any>();

    if (serverSupabase && allIds.length > 0) {
      try {
        const { data: profRows } = await serverSupabase
          .from('profiles')
          .select('*')
          .in('id', allIds);
        if (profRows) {
          profRows.forEach((p: any) => {
            fetchedProfilesMap.set(p.id, p);
            serverProfilesStore.set(p.id, p);
          });
        }
      } catch (e) {
        // ignore
      }
    }

    const followingProfiles = following.map((id) => {
      return (
        fetchedProfilesMap.get(id) ||
        serverProfilesStore.get(id) || {
          id,
          username: `user_${id.slice(0, 5)}`,
          display_name: 'User',
          avatar_url: null,
          bio: null,
          is_online: false,
        }
      );
    });

    const followerProfiles = followers.map((id) => {
      return (
        fetchedProfilesMap.get(id) ||
        serverProfilesStore.get(id) || {
          id,
          username: `user_${id.slice(0, 5)}`,
          display_name: 'User',
          avatar_url: null,
          bio: null,
          is_online: false,
        }
      );
    });

    return res.json({
      following,
      followers,
      followingCount: following.length,
      followersCount: followers.length,
      followingProfiles,
      followerProfiles,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve user overview' });
  }
});

// 1.c. Get all follower/following counts globally
app.get('/api/relations/all-counts', async (req, res) => {
  try {
    const counts: Record<string, { followers: number; following: number }> = {};

    // Ingest latest follows from database if serverSupabase is configured
    if (serverSupabase) {
      try {
        const { data: dbFollows } = await serverSupabase
          .from('follows')
          .select('follower_id, following_id');
        if (Array.isArray(dbFollows)) {
          dbFollows.forEach((r: any) => {
            if (r.follower_id && r.following_id) {
              followsStore.add(`${r.follower_id}:${r.following_id}`);
            }
          });
        }
      } catch (e) {
        // ignore db error
      }
    }

    for (const item of followsStore) {
      const [fId, tId] = item.split(':');
      if (fId && tId) {
        if (!counts[fId]) counts[fId] = { followers: 0, following: 0 };
        if (!counts[tId]) counts[tId] = { followers: 0, following: 0 };
        counts[fId].following += 1;
        counts[tId].followers += 1;
      }
    }
    return res.json({ counts });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve counts' });
  }
});

// ----------------------------------------------------
// REALTIME PRESENCE HEARTBEAT & OFFLINE ENDPOINTS
// ----------------------------------------------------
app.post('/api/presence/heartbeat', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { userId } = body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const now = new Date().toISOString();
    const existing = serverProfilesStore.get(userId) || {};
    serverProfilesStore.set(userId, { ...existing, id: userId, is_online: true, last_seen: now });

    if (serverSupabase) {
      serverSupabase
        .from('profiles')
        .update({ is_online: true, last_seen: now })
        .eq('id', userId)
        .then(() => {});
    }

    return res.json({ success: true, is_online: true, last_seen: now });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

app.post('/api/presence/offline', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { userId } = body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const now = new Date().toISOString();
    const existing = serverProfilesStore.get(userId) || {};
    serverProfilesStore.set(userId, { ...existing, id: userId, is_online: false, last_seen: now });

    if (serverSupabase) {
      serverSupabase
        .from('profiles')
        .update({ is_online: false, last_seen: now })
        .eq('id', userId)
        .then(() => {});
    }

    return res.json({ success: true, is_online: false, last_seen: now });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update offline state' });
  }
});

// 1.b. Get Relation Status between two users
app.post('/api/relations/status', async (req, res) => {
  try {
    const { userId, targetUserId, userUsername, targetUsername } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }

    if (userUsername && userId) {
      const existing = serverProfilesStore.get(userId) || {};
      serverProfilesStore.set(userId, { ...existing, id: userId, username: userUsername });
    }
    if (targetUsername && targetUserId) {
      const existing = serverProfilesStore.get(targetUserId) || {};
      serverProfilesStore.set(targetUserId, { ...existing, id: targetUserId, username: targetUsername });
    }

    let isFollowingThem = isFollowing(userId, targetUserId);
    let isFollowedByThem = isFollowing(targetUserId, userId);

    // Check aliases if usernames are provided
    if (userUsername && targetUsername) {
      if (followsStore.has(`${userUsername}:${targetUsername}`) || followsStore.has(`${userId}:${targetUsername}`) || followsStore.has(`${userUsername}:${targetUserId}`)) {
        isFollowingThem = true;
      }
      if (followsStore.has(`${targetUsername}:${userUsername}`) || followsStore.has(`${targetUserId}:${userUsername}`) || followsStore.has(`${targetUsername}:${userId}`)) {
        isFollowedByThem = true;
      }
    }

    // Enrich from Supabase without deleting existing in-memory state
    if (serverSupabase) {
      try {
        const [{ data: f1 }, { data: f2 }] = await Promise.all([
          serverSupabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', userId)
            .eq('following_id', targetUserId)
            .maybeSingle(),
          serverSupabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', targetUserId)
            .eq('following_id', userId)
            .maybeSingle(),
        ]);
        
        if (f1) {
          isFollowingThem = true;
          followsStore.add(`${userId}:${targetUserId}`);
        }
        if (f2) {
          isFollowedByThem = true;
          followsStore.add(`${targetUserId}:${userId}`);
        }
      } catch (e) {
        // ignore db error, keep in-memory values
      }
    }

    const isMutual = Boolean(isFollowingThem && isFollowedByThem);
    const isBlockedByMe = blockedStore.has(`${userId}:${targetUserId}`);
    const isBlockedByThem = blockedStore.has(`${targetUserId}:${userId}`);
    const counts = getFollowCounts(targetUserId);

    return res.json({
      isFollowing: isFollowingThem,
      isFollowedBy: isFollowedByThem,
      isMutual,
      isBlockedByMe,
      isBlockedByThem,
      isBlocked: isBlockedByMe || isBlockedByThem,
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve relation status' });
  }
});

// All counts overview
app.get('/api/relations/all-counts', (req, res) => {
  try {
    const counts: Record<string, { followers: number; following: number }> = {};
    for (const item of followsStore) {
      const [fId, tId] = item.split(':');
      if (!fId || !tId) continue;
      if (!counts[fId]) counts[fId] = { followers: 0, following: 0 };
      if (!counts[tId]) counts[tId] = { followers: 0, following: 0 };
      counts[fId].following += 1;
      counts[tId].followers += 1;
    }
    return res.json({ counts });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get all counts' });
  }
});

// Sync client local follows to server
app.post('/api/relations/sync', (req, res) => {
  try {
    const { userId, following, followers, username } = req.body;
    if (userId && Array.isArray(following)) {
      following.forEach((id: string) => {
        if (id && id !== userId) {
          followsStore.add(`${userId}:${id}`);
          if (username) followsStore.add(`${username}:${id}`);
        }
      });
    }
    if (userId && Array.isArray(followers)) {
      followers.forEach((id: string) => {
        if (id && id !== userId) {
          followsStore.add(`${id}:${userId}`);
          if (username) followsStore.add(`${id}:${username}`);
        }
      });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to sync relations' });
  }
});

// Ensure profile rows exist in Supabase to prevent foreign key errors
async function ensureDbProfile(userId: string, meta?: any) {
  if (!serverSupabase || !userId) return;
  try {
    const { data, error } = await serverSupabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!data || error) {
      const p = {
        id: userId,
        username: meta?.username || `user_${userId.slice(0, 8)}`,
        display_name: meta?.display_name || meta?.full_name || 'User',
        avatar_url: meta?.avatar_url || null,
        bio: meta?.bio || 'Hey there! I am using LiveConnect.',
        is_online: true,
        last_seen: new Date().toISOString(),
      };
      const { error: upsertErr } = await serverSupabase.from('profiles').upsert(p, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('[Supabase Profile Upsert Notice]:', upsertErr.message);
      }
      serverProfilesStore.set(userId, p);
    }
  } catch (e) {
    // ignore
  }
}

// 2. Follow a user
app.post('/api/relations/follow', async (req, res) => {
  try {
    const { userId, targetUserId, userMeta, targetMeta } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }
    if (userId === targetUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }
    if (isBlocked(userId, targetUserId)) {
      return res.status(403).json({ error: 'Cannot follow a blocked user' });
    }

    if (userMeta && userId) {
      serverProfilesStore.set(userId, { ...(serverProfilesStore.get(userId) || {}), ...userMeta, id: userId });
    }
    if (targetMeta && targetUserId) {
      serverProfilesStore.set(targetUserId, { ...(serverProfilesStore.get(targetUserId) || {}), ...targetMeta, id: targetUserId });
    }

    // Add canonical key and alias keys to followsStore
    followsStore.add(`${userId}:${targetUserId}`);
    if (userMeta?.username && targetMeta?.username) {
      followsStore.add(`${userMeta.username}:${targetMeta.username}`);
      followsStore.add(`${userId}:${targetMeta.username}`);
      followsStore.add(`${userMeta.username}:${targetUserId}`);
    } else if (userMeta?.username) {
      followsStore.add(`${userMeta.username}:${targetUserId}`);
    } else if (targetMeta?.username) {
      followsStore.add(`${userId}:${targetMeta.username}`);
    }

    // Check if target is already following user (in-memory or in database)
    let wasFollowedByTarget = isFollowing(targetUserId, userId);
    if (!wasFollowedByTarget && serverSupabase) {
      try {
        const { data: revFollow } = await serverSupabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', targetUserId)
          .eq('following_id', userId)
          .maybeSingle();
        if (revFollow) {
          wasFollowedByTarget = true;
          followsStore.add(`${targetUserId}:${userId}`);
        }
      } catch (e) {
        // ignore
      }
    }
    const isMutualNow = wasFollowedByTarget;

    // If serverSupabase is connected, write to DB directly
    if (serverSupabase) {
      try {
        await ensureDbProfile(userId, userMeta);
        await ensureDbProfile(targetUserId, targetMeta);
        const { error: dbErr } = await serverSupabase
          .from('follows')
          .upsert(
            { follower_id: userId, following_id: targetUserId },
            { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
          );
        if (dbErr) {
          console.warn('[Supabase DB Follow Warning]:', dbErr.message);
          // Try regular insert fallback
          const { error: fallbackErr } = await serverSupabase
            .from('follows')
            .insert({ follower_id: userId, following_id: targetUserId });
          if (fallbackErr) {
            console.warn('[Supabase DB Follow Fallback Warning]:', fallbackErr.message);
          } else {
            console.log(`[Supabase DB] Follow successfully inserted (fallback): ${userId} -> ${targetUserId}`);
          }
        } else {
          console.log(`[Supabase DB] Follow successfully recorded: ${userId} -> ${targetUserId}`);
        }
      } catch (dbEx: any) {
        console.warn('[Supabase DB Follow Exception]:', dbEx?.message || dbEx);
      }
    }

    const actorDisplayName = userMeta?.display_name || userMeta?.username || 'Someone';

    if (isMutualNow) {
      // Follow back notification
      addNotification(
        targetUserId,
        userId,
        'follow_back',
        'Followed you back',
        `${actorDisplayName} followed you back. You are now connected!`,
        userId,
        userMeta
      );
    } else {
      // Initial follow notification
      addNotification(
        targetUserId,
        userId,
        'follow',
        'New Follower',
        `${actorDisplayName} started following you. Follow back to chat & call!`,
        userId,
        userMeta
      );
    }

    const targetCounts = getFollowCounts(targetUserId);
    const userCounts = getFollowCounts(userId);

    return res.json({
      success: true,
      isFollowing: true,
      isFollowedBy: wasFollowedByTarget,
      isMutual: isMutualNow,
      followersCount: targetCounts.followersCount,
      followingCount: targetCounts.followingCount,
      targetUserId,
      targetFollowersCount: targetCounts.followersCount,
      targetFollowingCount: targetCounts.followingCount,
      userId,
      userFollowersCount: userCounts.followersCount,
      userFollowingCount: userCounts.followingCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process follow' });
  }
});

// 3. Unfollow a user
app.post('/api/relations/unfollow', async (req, res) => {
  try {
    const { userId, targetUserId, userUsername, targetUsername } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }

    const pUser = serverProfilesStore.get(userId);
    const pTarget = serverProfilesStore.get(targetUserId);

    // Clean up all permutations in followsStore for this follower -> following direction
    for (const item of Array.from(followsStore)) {
      const [f, t] = item.split(':');
      if (
        (f === userId || (userUsername && f === userUsername) || (pUser?.username && f === pUser.username)) &&
        (t === targetUserId || (targetUsername && t === targetUsername) || (pTarget?.username && t === pTarget.username))
      ) {
        followsStore.delete(item);
      }
    }

    // If serverSupabase is connected, delete from DB directly
    if (serverSupabase) {
      try {
        const { error: delErr } = await serverSupabase
          .from('follows')
          .delete()
          .match({ follower_id: userId, following_id: targetUserId });
        if (delErr) {
          console.warn('[Supabase DB Unfollow Warning]:', delErr.message);
        } else {
          console.log(`[Supabase DB] Unfollow recorded: ${userId} -> ${targetUserId}`);
        }
      } catch (delEx) {
        // ignore
      }
    }

    const isFollowedByThem = isFollowing(targetUserId, userId);
    const targetCounts = getFollowCounts(targetUserId);
    const userCounts = getFollowCounts(userId);

    return res.json({
      success: true,
      isFollowing: false,
      isFollowedBy: isFollowedByThem,
      isMutual: false,
      followersCount: targetCounts.followersCount,
      followingCount: targetCounts.followingCount,
      targetUserId,
      targetFollowersCount: targetCounts.followersCount,
      targetFollowingCount: targetCounts.followingCount,
      userId,
      userFollowersCount: userCounts.followersCount,
      userFollowingCount: userCounts.followingCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to unfollow' });
  }
});

// 4. Block a user
app.post('/api/relations/block', (req, res) => {
  try {
    const { userId, targetUserId } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }
    if (userId === targetUserId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    blockedStore.add(`${userId}:${targetUserId}`);

    // Immediately remove follow relationships in both directions
    followsStore.delete(`${userId}:${targetUserId}`);
    followsStore.delete(`${targetUserId}:${userId}`);

    const counts = getFollowCounts(targetUserId);

    return res.json({
      success: true,
      isBlockedByMe: true,
      isBlocked: true,
      isFollowing: false,
      isFollowedBy: false,
      isMutual: false,
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to block user' });
  }
});

// 5. Unblock a user
app.post('/api/relations/unblock', (req, res) => {
  try {
    const { userId, targetUserId } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }

    blockedStore.delete(`${userId}:${targetUserId}`);
    // NOTE: per specification, unblock does NOT restore old follow relationships!

    const counts = getFollowCounts(targetUserId);

    return res.json({
      success: true,
      isBlockedByMe: false,
      isBlocked: false,
      isFollowing: false,
      isFollowedBy: false,
      isMutual: false,
      followersCount: counts.followersCount,
      followingCount: counts.followingCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// 6. Check mutual follow check endpoint
app.post('/api/relations/check-mutual', async (req, res) => {
  try {
    const { userA, userB } = req.body;
    if (!userA || !userB) {
      return res.status(400).json({ error: 'userA and userB are required' });
    }

    const blocked = isBlocked(userA, userB);
    const mutual = !blocked && (await verifyMutualFollow(userA, userB));

    return res.json({
      isMutual: mutual,
      mutual,
      blocked,
      userAFollowsUserB: isFollowing(userA, userB),
      userBFollowsUserA: isFollowing(userB, userA),
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check mutual status' });
  }
});

// ----------------------------------------------------
// NOTIFICATIONS ENDPOINTS
// ----------------------------------------------------

// 7. Get notifications list for user
app.post('/api/notifications/list', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const notifs = notificationsStore.get(userId) || [];
    const unreadCount = notifs.filter((n) => !n.is_read).length;

    return res.json({
      notifications: notifs,
      unreadCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// 8. Mark notification as read
app.post('/api/notifications/mark-read', (req, res) => {
  try {
    const { userId, notificationId } = req.body;
    if (!userId || !notificationId) {
      return res.status(400).json({ error: 'userId and notificationId are required' });
    }

    const notifs = notificationsStore.get(userId) || [];
    const updated = notifs.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n));
    notificationsStore.set(userId, updated);

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// 9. Mark all notifications as read
app.post('/api/notifications/mark-all-read', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const notifs = notificationsStore.get(userId) || [];
    const updated = notifs.map((n) => ({ ...n, is_read: true }));
    notificationsStore.set(userId, updated);

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// 10. Create notification (message, call, etc.)
app.post('/api/notifications/create', (req, res) => {
  try {
    const { userId, actorId, type, title, message, referenceId, actorMeta } = req.body;
    if (!userId || !actorId || !type) {
      return res.status(400).json({ error: 'userId, actorId, and type are required' });
    }

    const newNotif = addNotification(userId, actorId, type, title, message, referenceId, actorMeta);
    return res.json({ success: true, notification: newNotif });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create notification' });
  }
});

// ----------------------------------------------------
// CALL SIGNALING & RELAY STORE
// ----------------------------------------------------
interface ServerCall {
  id: string;
  caller_id: string;
  callee_id: string;
  callerDeviceId?: string;
  calleeDeviceId?: string;
  call_type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'cancelled' | 'missed';
  room_name: string;
  caller?: any;
  callee?: any;
  created_at: string;
  updated_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
}

const serverCallsStore = new Map<string, ServerCall>();
const serverSignalsStore = new Map<string, any[]>();

// 1. Create / Dispatch Outgoing Call
app.post('/api/calls/create', async (req, res) => {
  try {
    const { call, callerMeta } = req.body;
    if (!call || !call.id || !call.caller_id || !call.callee_id) {
      return res.status(400).json({ error: 'Valid call object with caller_id and callee_id required' });
    }

    if (isBlocked(call.caller_id, call.callee_id)) {
      return res.status(403).json({ error: 'Cannot call blocked user' });
    }

    // Auto-link users as mutual follows upon placing a call
    if (call.caller_id !== call.callee_id) {
      followsStore.add(`${call.caller_id}:${call.callee_id}`);
      followsStore.add(`${call.callee_id}:${call.caller_id}`);
    }

    const callerObj = callerMeta || serverProfilesStore.get(call.caller_id) || {
      id: call.caller_id,
      username: 'Caller',
      display_name: 'Caller',
      avatar_url: null,
    };

    const newCall: ServerCall = {
      id: call.id,
      caller_id: call.caller_id,
      callee_id: call.callee_id,
      callerDeviceId: call.callerDeviceId,
      calleeDeviceId: call.calleeDeviceId,
      call_type: call.call_type || 'audio',
      status: 'calling',
      room_name: call.room_name || `room_${call.caller_id.slice(0, 6)}_${Date.now()}`,
      caller: callerObj,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    serverCallsStore.set(newCall.id, newCall);

    // Add push notification for callee
    const callerName = callerObj?.display_name || callerObj?.username || 'Someone';
    addNotification(
      call.callee_id,
      call.caller_id,
      call.call_type === 'video' ? 'call_video' : 'call_audio',
      `Incoming ${call.call_type === 'video' ? 'Video' : 'Voice'} Call`,
      `${callerName} is calling you...`,
      newCall.id,
      callerObj
    );

    // Also sync to Supabase calls table in background if available
    if (serverSupabase) {
      serverSupabase
        .channel(`calls_channel_${newCall.callee_id}`)
        .send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: newCall,
        });

      serverSupabase
        .from('calls')
        .upsert(
          {
            id: newCall.id,
            caller_id: newCall.caller_id,
            callee_id: newCall.callee_id,
            call_type: newCall.call_type,
            status: newCall.status,
            room_name: newCall.room_name,
            created_at: newCall.created_at,
            updated_at: newCall.updated_at,
          },
          { onConflict: 'id' }
        )
        .then(() => {})
        .catch(() => {});
    }

    return res.json({ success: true, call: newCall });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to dispatch call' });
  }
});

// 2. Callee: Get Pending / Ringing Incoming Calls for User
app.post('/api/calls/incoming', async (req, res) => {
  try {
    const { userId, username, deviceId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const now = Date.now();
    const pendingCalls: ServerCall[] = [];

    // Check memory store
    for (const [, call] of serverCallsStore) {
      // If this device is the one that initiated the call, don't ring itself
      if (deviceId && call.callerDeviceId && call.callerDeviceId === deviceId) {
        continue;
      }

      // Check if user is the callee by userId OR by username
      const isTarget =
        call.callee_id === userId ||
        (username && call.callee_id === username) ||
        (call.callee && (call.callee.id === userId || call.callee.username === username));

      const isCrossDeviceSelfCall =
        call.caller_id === userId &&
        call.callee_id === userId &&
        Boolean(call.callerDeviceId && (!deviceId || call.callerDeviceId !== deviceId));

      if (isTarget || isCrossDeviceSelfCall) {
        const age = now - new Date(call.created_at).getTime();
        // Only consider calls created within the last 90 seconds that are calling or ringing
        if (age < 90000 && (call.status === 'calling' || call.status === 'ringing')) {
          pendingCalls.push(call);
        }
      }
    }

    // If memory store is empty and serverSupabase is available, check DB
    if (pendingCalls.length === 0 && serverSupabase) {
      try {
        const ninetySecondsAgo = new Date(now - 90000).toISOString();
        const { data: dbCalls } = await serverSupabase
          .from('calls')
          .select('*')
          .eq('callee_id', userId)
          .in('status', ['calling', 'ringing'])
          .gte('created_at', ninetySecondsAgo)
          .order('created_at', { ascending: false })
          .limit(2);

        if (Array.isArray(dbCalls) && dbCalls.length > 0) {
          for (const c of dbCalls) {
            let callerProfile = serverProfilesStore.get(c.caller_id);
            if (!callerProfile) {
              const { data: p } = await serverSupabase
                .from('profiles')
                .select('*')
                .eq('id', c.caller_id)
                .single();
              if (p) {
                callerProfile = p;
                serverProfilesStore.set(p.id, p);
              }
            }

            const restoredCall: ServerCall = {
              id: c.id,
              caller_id: c.caller_id,
              callee_id: c.callee_id,
              call_type: c.call_type || 'audio',
              status: c.status,
              room_name: c.room_name,
              caller: callerProfile || {
                id: c.caller_id,
                username: 'Caller',
                display_name: 'Caller',
                avatar_url: null,
              },
              created_at: c.created_at,
              updated_at: c.updated_at,
            };

            serverCallsStore.set(restoredCall.id, restoredCall);
            pendingCalls.push(restoredCall);
          }
        }
      } catch (dbErr) {
        // ignore db error
      }
    }

    return res.json({ calls: pendingCalls });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check incoming calls' });
  }
});

// 3. Check Current Call Status
app.post('/api/calls/status', (req, res) => {
  try {
    const { callId } = req.body;
    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }

    const call = serverCallsStore.get(callId);
    if (!call) {
      return res.json({ exists: false, status: 'unknown' });
    }

    return res.json({ exists: true, status: call.status, call });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to check call status' });
  }
});

// 4. Perform Action on Call (ring, accept, reject, cancel, end)
app.post('/api/calls/action', (req, res) => {
  try {
    const { callId, action, userId, calleeDeviceId } = req.body;
    if (!callId || !action) {
      return res.status(400).json({ error: 'callId and action are required' });
    }

    let call = serverCallsStore.get(callId);
    const nowIso = new Date().toISOString();

    if (!call) {
      // If not in memory, create a stub so status is known
      call = {
        id: callId,
        caller_id: userId || 'unknown',
        callee_id: 'unknown',
        calleeDeviceId,
        call_type: 'audio',
        status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : action === 'cancel' ? 'cancelled' : 'ended',
        room_name: `room_${callId}`,
        created_at: nowIso,
        updated_at: nowIso,
        answered_at: action === 'accept' ? nowIso : undefined,
        ended_at: ['ended', 'rejected', 'cancelled'].includes(action) ? nowIso : undefined,
      };
      serverCallsStore.set(callId, call);
    } else {
      if (action === 'ring' && call.status === 'calling') {
        call.status = 'ringing';
      } else if (action === 'accept') {
        call.status = 'accepted';
        call.answered_at = nowIso;
        if (calleeDeviceId) {
          call.calleeDeviceId = calleeDeviceId;
        }
      } else if (action === 'reject') {
        call.status = 'rejected';
        call.ended_at = nowIso;
      } else if (action === 'cancel') {
        call.status = 'cancelled';
        call.ended_at = nowIso;
      } else if (action === 'end') {
        call.status = 'ended';
        call.ended_at = nowIso;
      }
      call.updated_at = nowIso;
    }

    // Sync to Supabase in background
    if (serverSupabase) {
      serverSupabase
        .channel(`calls_channel_${call.caller_id}`)
        .send({
          type: 'broadcast',
          event: 'call_action',
          payload: { callId, action, status: call.status, calleeDeviceId }
        });

      serverSupabase
        .channel(`calls_channel_${call.callee_id}`)
        .send({
          type: 'broadcast',
          event: 'call_action',
          payload: { callId, action, status: call.status, calleeDeviceId }
        });

      serverSupabase
        .from('calls')
        .update({
          status: call.status,
          answered_at: call.answered_at || null,
          ended_at: call.ended_at || null,
          updated_at: nowIso,
        })
        .eq('id', callId)
        .then(() => {})
        .catch(() => {});
    }

    return res.json({ success: true, status: call.status, call });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update call action' });
  }
});

// 5. WebRTC Signaling Relay (Offer, Answer, ICE Candidates)
app.post('/api/calls/signal', (req, res) => {
  try {
    const signal = req.body;
    if (signal && signal.callId) {
      const payload = {
        ...signal,
        id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      };

      if (signal.targetDeviceId) {
        const devKey = `${signal.callId}_${signal.targetDeviceId}`;
        const existing = serverSignalsStore.get(devKey) || [];
        serverSignalsStore.set(devKey, [...existing.slice(-40), payload]);
      }

      if (signal.targetId) {
        const userKey = `${signal.callId}_${signal.targetId}`;
        const existing = serverSignalsStore.get(userKey) || [];
        serverSignalsStore.set(userKey, [...existing.slice(-40), payload]);
      }

      // Also store under callId as shared bus
      const globalKey = `call_${signal.callId}`;
      const globalExisting = serverSignalsStore.get(globalKey) || [];
      serverSignalsStore.set(globalKey, [...globalExisting.slice(-40), payload]);
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process signal' });
  }
});

// 6. Retrieve Pending WebRTC Signals
app.post('/api/calls/signals', (req, res) => {
  try {
    const { callId, targetId, deviceId } = req.body;
    if (!callId) {
      return res.json({ signals: [] });
    }

    const collected: any[] = [];
    const seenIds = new Set<string>();

    const checkKey = (key: string) => {
      const list = serverSignalsStore.get(key) || [];
      for (const sig of list) {
        // Skip signals sent by this device
        if (deviceId && sig.senderDeviceId && sig.senderDeviceId === deviceId) {
          continue;
        }
        if (!seenIds.has(sig.id)) {
          seenIds.add(sig.id);
          collected.push(sig);
        }
      }
    };

    if (deviceId) {
      checkKey(`${callId}_${deviceId}`);
    }
    if (targetId) {
      checkKey(`${callId}_${targetId}`);
    }
    checkKey(`call_${callId}`);

    return res.json({ signals: collected });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get signals' });
  }
});

// 6.a. Global WebRTC ICE & TURN Servers Configuration
app.get('/api/webrtc/ice-servers', (req, res) => {
  try {
    const customTurnUrl = process.env.TURN_URL || process.env.VITE_TURN_URL;
    const customTurnUser = process.env.TURN_USERNAME || process.env.VITE_TURN_USERNAME;
    const customTurnPass = process.env.TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL;

    const iceServers: RTCIceServer[] = [
      // Primary Google Anycast STUN Servers (Low latency worldwide, including India, APAC, EU, US, MEA)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Cloudflare & Mozilla Global STUN Fallbacks
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      // OpenRelay Public TURN servers for firewall & mobile carrier NAT traversal
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelay',
        credential: 'openrelay',
      },
    ];

    if (customTurnUrl) {
      iceServers.unshift({
        urls: customTurnUrl.split(','),
        username: customTurnUser || undefined,
        credential: customTurnPass || undefined,
      });
    }

    return res.json({
      iceServers,
      iceCandidatePoolSize: 6,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
  } catch (error: any) {
    return res.status(500).json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  }
});

// 6.b. Retrieve Call History for User from Relay Store
app.post('/api/calls/history', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const userCalls: ServerCall[] = [];
    for (const [, call] of serverCallsStore) {
      if (call.caller_id === userId || call.callee_id === userId) {
        userCalls.push(call);
      }
    }

    userCalls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json({ calls: userCalls.slice(0, 50) });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get call history' });
  }
});

// ----------------------------------------------------
// CONVERSATIONS & MESSAGES BACKEND RELAY & SYNC
// ----------------------------------------------------

// 1. Get or Create Direct Conversation
app.post('/api/conversations/create-or-get', async (req, res) => {
  try {
    const { userId, targetUserId, userProfile, targetProfile } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }

    if (isBlocked(userId, targetUserId)) {
      return res.status(403).json({ error: 'Cannot start conversation with blocked user' });
    }

    const convId = getDeterministicDirectConvId(userId, targetUserId);
    const nowIso = new Date().toISOString();

    // Revive conversation if it was deleted previously and user explicitly starts chat again
    deletedConversationsServerStore.delete(convId);

    // Cache profiles in server store
    if (userProfile?.id) serverProfilesStore.set(userProfile.id, userProfile);
    if (targetProfile?.id) serverProfilesStore.set(targetProfile.id, targetProfile);

    let conv = serverConversationsStore.get(convId);
    if (!conv) {
      conv = {
        id: convId,
        type: 'direct',
        member_ids: userId === targetUserId ? [userId] : [userId, targetUserId],
        members_meta: {
          [userId]: userProfile || serverProfilesStore.get(userId),
          [targetUserId]: targetProfile || serverProfilesStore.get(targetUserId),
        },
        created_at: nowIso,
        updated_at: nowIso,
        last_message: null,
      };
      serverConversationsStore.set(convId, conv);
    }

    // Sync to Supabase in background
    if (serverSupabase) {
      (async () => {
        try {
          await serverSupabase
            .from('conversations')
            .upsert({ id: convId, type: 'direct', updated_at: nowIso }, { onConflict: 'id' });

          await serverSupabase
            .from('conversation_members')
            .upsert({ conversation_id: convId, user_id: userId }, { onConflict: 'conversation_id,user_id' });

          if (userId !== targetUserId) {
            await serverSupabase
              .from('conversation_members')
              .upsert({ conversation_id: convId, user_id: targetUserId }, { onConflict: 'conversation_id,user_id' });
          }
        } catch (e) {
          // ignore
        }
      })();
    }

    const otherProfile =
      userId === targetUserId
        ? conv.members_meta?.[userId]
        : conv.members_meta?.[targetUserId] || serverProfilesStore.get(targetUserId);

    return res.json({
      success: true,
      conversationId: convId,
      conversation: {
        id: conv.id,
        type: conv.type,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        other_member: otherProfile,
        last_message: conv.last_message,
        unread_count: 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create or get conversation' });
  }
});

// 2. List Conversations for a User
app.post('/api/conversations/list', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const directMap = new Map<string, any>(); // otherId -> conv
    const groupList: any[] = [];

    for (const [, conv] of serverConversationsStore) {
      if (deletedConversationsServerStore.has(conv.id)) {
        continue;
      }
      if (conv.member_ids.includes(userId)) {
        const otherId = conv.member_ids.find((id) => id !== userId) || userId;
        const otherProfile =
          conv.members_meta?.[otherId] || serverProfilesStore.get(otherId) || {
            id: otherId,
            username: 'User',
            display_name: 'User',
            avatar_url: null,
          };

        const msgs = messagesServerStore.get(conv.id) || [];
        const validMsgs = msgs.filter((m) => m && !deletedMessagesServerStore.has(m.id));
        const sortedMsgs = [...validMsgs].sort(
          (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
        const lastMsg = sortedMsgs.length > 0 ? sortedMsgs[sortedMsgs.length - 1] : conv.last_message || null;
        const unreadCount = validMsgs.filter((m) => m.sender_id !== userId && !m.is_read).length;

        const effectiveUpdatedAt = lastMsg?.created_at
          ? (new Date(lastMsg.created_at).getTime() > new Date(conv.updated_at || 0).getTime()
              ? lastMsg.created_at
              : conv.updated_at)
          : conv.updated_at;

        const convObj = {
          id: conv.id,
          type: conv.type,
          created_at: conv.created_at,
          updated_at: effectiveUpdatedAt,
          other_member: otherProfile,
          last_message: lastMsg,
          unread_count: unreadCount,
        };

        if (conv.type === 'direct' || !conv.type) {
          const existing = directMap.get(otherId);
          if (!existing) {
            directMap.set(otherId, convObj);
          } else {
            const timeExisting = new Date(existing.updated_at || 0).getTime();
            const timeNew = new Date(convObj.updated_at || 0).getTime();
            if (timeNew >= timeExisting) {
              directMap.set(otherId, {
                ...existing,
                ...convObj,
                unread_count: Math.max(existing.unread_count || 0, convObj.unread_count || 0),
              });
            }
          }
        } else {
          groupList.push(convObj);
        }
      }
    }

    const result = [...Array.from(directMap.values()), ...groupList];

    // Sort by updated_at descending
    result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return res.json({ conversations: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// 3. Send / Sync a Message
app.post('/api/messages/send', async (req, res) => {
  try {
    const { message, recipientId, receiverId, senderProfile, recipientProfile, receiverProfile } = req.body;
    if (!message || !message.conversation_id || !message.sender_id || !message.content) {
      return res.status(400).json({ error: 'Valid message object required' });
    }

    const convId = message.conversation_id;
    const senderId = message.sender_id;
    const nowIso = message.created_at || new Date().toISOString();

    // Revive conversation from deleted set if a new message is sent
    deletedConversationsServerStore.delete(convId);

    let targetRecipient = recipientId || receiverId;
    if (!targetRecipient) {
      const existingConv = serverConversationsStore.get(convId);
      if (existingConv) {
        targetRecipient = existingConv.member_ids.find((id) => id !== senderId);
      }
    }

    // Communication check: 1-to-1 messaging allowed as long as not blocked
    if (targetRecipient && targetRecipient !== senderId) {
      if (isBlocked(senderId, targetRecipient)) {
        return res.status(403).json({ error: 'Cannot message blocked user' });
      }

      // Auto-establish connection between sender and receiver on message
      try {
        followsStore.add(`${senderId}:${targetRecipient}`);
        followsStore.add(`${targetRecipient}:${senderId}`);
      } catch {}
    }

    const recProfile = recipientProfile || receiverProfile;
    if (senderProfile?.id) {
      serverProfilesStore.set(senderProfile.id, senderProfile);
    }
    if (recProfile?.id) {
      serverProfilesStore.set(recProfile.id, recProfile);
    }

    const existing = messagesServerStore.get(convId) || [];
    
    // Avoid duplicates or update existing message
    const existingIdx = existing.findIndex((m) => {
      if (m.id === message.id) return true;
      if (
        m.sender_id === message.sender_id &&
        m.content === message.content &&
        Math.abs(new Date(m.created_at || 0).getTime() - new Date(message.created_at || 0).getTime()) < 45000
      ) {
        return true;
      }
      if (
        m.content?.startsWith('[CALL_LOG:') &&
        message.content?.startsWith('[CALL_LOG:') &&
        Math.abs(new Date(m.created_at || 0).getTime() - new Date(message.created_at || 0).getTime()) < 60000
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx >= 0) {
      const prevMsg = existing[existingIdx];
      const isNewAnswered = message.content?.includes(':answered:') && !prevMsg.content?.includes(':answered:');
      const isNewEnded = message.content?.includes(':ended:') && !prevMsg.content?.includes(':ended:');

      existing[existingIdx] = {
        ...prevMsg,
        ...message,
        id: isNewAnswered || isNewEnded ? message.id : prevMsg.id,
        content: isNewAnswered || isNewEnded ? message.content : (message.content || prevMsg.content),
        is_read: false,
      };
      messagesServerStore.set(convId, [...existing]);
    } else {
      messagesServerStore.set(convId, [...existing, { ...message, is_read: false }]);
    }

    // Update conversation record in server memory
    let conv = serverConversationsStore.get(convId);
    if (conv) {
      conv.updated_at = nowIso;
      conv.last_message = message;
      if (recipientId && !conv.member_ids.includes(recipientId)) {
        conv.member_ids.push(recipientId);
      }
    } else {
      const memberIds = recipientId && recipientId !== senderId ? [senderId, recipientId] : [senderId];
      conv = {
        id: convId,
        type: 'direct',
        member_ids: memberIds,
        members_meta: {
          [senderId]: senderProfile || serverProfilesStore.get(senderId),
          ...(recipientId ? { [recipientId]: recipientProfile || serverProfilesStore.get(recipientId) } : {}),
        },
        created_at: nowIso,
        updated_at: nowIso,
        last_message: message,
      };
      serverConversationsStore.set(convId, conv);
    }

    // Determine target recipient for push notification
    if (!targetRecipient && conv) {
      targetRecipient = conv.member_ids.find((id) => id !== senderId);
    }

    if (targetRecipient && targetRecipient !== senderId) {
      const senderName =
        senderProfile?.display_name ||
        senderProfile?.username ||
        serverProfilesStore.get(senderId)?.display_name ||
        'Someone';

      let notifPreview = message.content;
      if (notifPreview.startsWith('[IMAGE:')) {
        const parts = notifPreview.slice(7, -1).split(':');
        const caption = parts.length > 2 ? parts.slice(2).join(':') : (parts.length === 2 && !parts[1].startsWith('/') ? parts[1] : '');
        notifPreview = caption ? `📷 Photo: ${caption}` : '📷 Sent a photo';
      } else if (notifPreview.startsWith('[VOICE:')) {
        notifPreview = '🎙️ Sent a voice note';
      } else if (notifPreview.startsWith('[STICKER:')) {
        notifPreview = '✨ Sent a sticker';
      }

      addNotification(
        targetRecipient,
        senderId,
        'message',
        `New message from ${senderName}`,
        notifPreview,
        convId,
        senderProfile || serverProfilesStore.get(senderId)
      );
    }

    // Sync to Supabase in background (ensure conversation & members exist first!)
    if (serverSupabase) {
      (async () => {
        try {
          // 1. Ensure conversation exists in DB
          await serverSupabase
            .from('conversations')
            .upsert({ id: convId, type: 'direct', updated_at: nowIso }, { onConflict: 'id' });

          // 2. Ensure members exist in DB
          await serverSupabase
            .from('conversation_members')
            .upsert({ conversation_id: convId, user_id: senderId }, { onConflict: 'conversation_id,user_id' });

          if (targetRecipient && targetRecipient !== senderId) {
            await serverSupabase
              .from('conversation_members')
              .upsert({ conversation_id: convId, user_id: targetRecipient }, { onConflict: 'conversation_id,user_id' });
          }

          // 3. Insert message (ensure content is safe for db constraints)
          await serverSupabase
            .from('messages')
            .upsert({
              id: message.id,
              conversation_id: convId,
              sender_id: senderId,
              content: message.content,
              created_at: nowIso,
              updated_at: nowIso,
            }, { onConflict: 'id' });
        } catch (dbErr) {
          // ignore db error
        }
      })();
    }

    return res.json({ success: true, message });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to send message via relay' });
  }
});

// ----------------------------------------------------
// MEDIA STORAGE & FILE SERVING API
// ----------------------------------------------------

// Upload image / voice note / attachment
app.post('/api/media/upload', async (req, res) => {
  try {
    const { base64Data, mimeType, fileName, mediaType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required' });
    }

    const rawType = mimeType || (mediaType === 'audio' ? 'audio/webm' : 'image/jpeg');
    let type = rawType.split(';')[0].trim().toLowerCase();
    let buffer = Buffer.from(base64Data, 'base64');
    let ext = 'bin';

    // If audio (voice note / sound clip), automatically transcode to standard MP3 for universal compatibility across iOS Safari, Chrome, and Android
    const isAudio = mediaType === 'audio' || type.startsWith('audio/') || type.includes('webm') || type.includes('opus') || type.includes('ogg');
    if (isAudio) {
      try {
        const mp3Buffer = await transcodeAudioToMp3(buffer);
        if (mp3Buffer && mp3Buffer.length > 0) {
          buffer = mp3Buffer;
          type = 'audio/mpeg';
          ext = 'mp3';
        }
      } catch (tErr) {
        console.warn('Audio transcode notice on upload, using source:', tErr);
      }
    }

    // Determine file extension if not already set
    if (ext === 'bin') {
      if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
      else if (type.includes('png')) ext = 'png';
      else if (type.includes('webp')) ext = 'webp';
      else if (type.includes('gif')) ext = 'gif';
      else if (type.includes('mp3') || type.includes('mpeg')) ext = 'mp3';
      else if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) ext = 'mp4';
      else if (type.includes('webm')) ext = 'webm';
      else if (type.includes('ogg') || type.includes('opus')) ext = 'ogg';
      else if (type.includes('wav')) ext = 'wav';
    }

    const fileId = `${mediaType || 'file'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    
    const mediaRecord: MediaFileRecord = {
      id: fileId,
      buffer,
      mimeType: type,
      fileName: fileName || fileId,
      size: buffer.length,
      createdAt: new Date().toISOString(),
      mp3Buffer: ext === 'mp3' ? buffer : undefined,
    };

    mediaFilesStore.set(fileId, mediaRecord);

    // Also persist to disk so media survives server restarts
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, fileId), buffer);
    } catch (diskErr) {
      console.warn('Could not write uploaded media to disk:', diskErr);
    }

    const publicUrl = `/api/media/file/${fileId}`;
    return res.json({
      success: true,
      url: publicUrl,
      fileId,
      mimeType: type,
      size: buffer.length,
    });
  } catch (err: any) {
    console.error('Media upload error:', err);
    return res.status(500).json({ error: 'Failed to process media upload' });
  }
});

// Transcode arbitrary audio data (e.g. recovering older WebM voice notes or data URLs) into standard playable MP3
app.post('/api/media/transcode', async (req, res) => {
  try {
    const { base64Data, fileId } = req.body;
    let inputBuf: Buffer | null = null;
    if (base64Data) {
      inputBuf = Buffer.from(base64Data, 'base64');
    } else if (fileId) {
      const rec = mediaFilesStore.get(fileId);
      if (rec) {
        inputBuf = rec.buffer;
      } else {
        const diskPath = path.join(process.cwd(), 'uploads', fileId);
        if (fs.existsSync(diskPath)) {
          inputBuf = fs.readFileSync(diskPath);
        }
      }
    }

    if (!inputBuf || inputBuf.length === 0) {
      return res.status(400).json({ error: 'Valid audio data or fileId required' });
    }

    const mp3Buf = await transcodeAudioToMp3(inputBuf);
    const newFileId = `audio_transcoded_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.mp3`;
    const record: MediaFileRecord = {
      id: newFileId,
      buffer: mp3Buf,
      mimeType: 'audio/mpeg',
      fileName: newFileId,
      size: mp3Buf.length,
      createdAt: new Date().toISOString(),
      mp3Buffer: mp3Buf,
    };
    mediaFilesStore.set(newFileId, record);

    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, newFileId), mp3Buf);
    } catch {}

    return res.json({
      success: true,
      url: `/api/media/file/${newFileId}`,
      fileId: newFileId,
      mimeType: 'audio/mpeg',
      size: mp3Buf.length,
    });
  } catch (err: any) {
    console.error('Audio transcode error:', err);
    return res.status(500).json({ error: 'Failed to transcode audio' });
  }
});

// Stream / Serve Media File with proper cache & audio range support
app.get('/api/media/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).send('File ID required');
    }

    let record = mediaFilesStore.get(fileId);

    // If not in RAM, attempt to read from disk cache
    if (!record) {
      try {
        const diskPath = path.join(process.cwd(), 'uploads', fileId);
        if (fs.existsSync(diskPath)) {
          const diskBuf = fs.readFileSync(diskPath);
          let fallbackMime = 'application/octet-stream';
          if (fileId.endsWith('.webm')) fallbackMime = 'audio/webm';
          else if (fileId.endsWith('.ogg')) fallbackMime = 'audio/ogg';
          else if (fileId.endsWith('.mp4') || fileId.endsWith('.m4a')) fallbackMime = 'audio/mp4';
          else if (fileId.endsWith('.mp3')) fallbackMime = 'audio/mpeg';
          else if (fileId.endsWith('.wav')) fallbackMime = 'audio/wav';
          else if (fileId.endsWith('.jpg') || fileId.endsWith('.jpeg')) fallbackMime = 'image/jpeg';
          else if (fileId.endsWith('.png')) fallbackMime = 'image/png';
          else if (fileId.endsWith('.webp')) fallbackMime = 'image/webp';

          record = {
            id: fileId,
            buffer: diskBuf,
            mimeType: fallbackMime,
            fileName: fileId,
            size: diskBuf.length,
            createdAt: new Date().toISOString(),
          };
          mediaFilesStore.set(fileId, record);
        }
      } catch (diskReadErr) {
        console.warn('Disk media read notice:', diskReadErr);
      }
    }

    if (!record) {
      return res.status(404).send('Media file not found');
    }

    let cleanMime = (record.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!cleanMime || cleanMime === 'application/octet-stream') {
      if (fileId.endsWith('.webm')) cleanMime = 'audio/webm';
      else if (fileId.endsWith('.ogg')) cleanMime = 'audio/ogg';
      else if (fileId.endsWith('.mp4') || fileId.endsWith('.m4a')) cleanMime = 'audio/mp4';
      else if (fileId.endsWith('.mp3')) cleanMime = 'audio/mpeg';
      else if (fileId.endsWith('.wav')) cleanMime = 'audio/wav';
      else if (fileId.endsWith('.jpg') || fileId.endsWith('.jpeg')) cleanMime = 'image/jpeg';
      else if (fileId.endsWith('.png')) cleanMime = 'image/png';
      else if (fileId.endsWith('.webp')) cleanMime = 'image/webp';
    }

    // If this is a WebM audio file and hasn't been transcoded to MP3, transcode and cache so Safari and iOS play without Format error
    if ((fileId.endsWith('.webm') || cleanMime.includes('webm')) && !record.mp3Buffer) {
      try {
        const mp3Buf = await transcodeAudioToMp3(record.buffer);
        if (mp3Buf && mp3Buf.length > 0) {
          record.mp3Buffer = mp3Buf;
        }
      } catch (transcodeErr) {
        console.warn('On-demand transcode notice:', transcodeErr);
      }
    }

    const activeBuffer = record.mp3Buffer || record.buffer;
    const activeMime = record.mp3Buffer ? 'audio/mpeg' : cleanMime;
    const totalSize = activeBuffer.length;

    if (totalSize === 0) {
      res.writeHead(200, {
        'Content-Length': 0,
        'Content-Type': activeMime,
        'Accept-Ranges': 'bytes',
      });
      return res.end();
    }

    // Handle range requests (crucial for audio/video scrub and seek)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      let start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      if (isNaN(start)) start = 0;
      if (isNaN(end) || end >= totalSize) end = totalSize - 1;
      if (start > end) start = 0;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': activeMime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      return res.end(activeBuffer.subarray(start, end + 1));
    }

    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': activeMime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    return res.end(activeBuffer);
  } catch (err: any) {
    return res.status(500).send('Error serving media file');
  }
});

// 4. List messages for conversation
const deletedMessagesServerStore = new Set<string>();

app.post('/api/messages/list', async (req, res) => {
  try {
    const { conversationId, candidateIds } = req.body;
    if (!conversationId && (!Array.isArray(candidateIds) || candidateIds.length === 0)) {
      return res.status(400).json({ error: 'conversationId required' });
    }

    const allIds: string[] = Array.from(
      new Set([conversationId, ...(Array.isArray(candidateIds) ? candidateIds : [])].filter(Boolean))
    );

    let msgs: any[] = [];
    const memoryMap = new Map<string, any>();
    allIds.forEach((id) => {
      const stored = messagesServerStore.get(id) || [];
      stored.forEach((m) => memoryMap.set(m.id, m));
    });
    msgs = Array.from(memoryMap.values());

    // DB fallback if server memory is empty or to ensure complete history
    if (serverSupabase) {
      try {
        const { data: dbMsgs } = await serverSupabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .in('conversation_id', allIds)
          .order('created_at', { ascending: true })
          .limit(200);

        if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
          const map = new Map<string, any>();
          dbMsgs.forEach((m) => {
            map.set(m.id, m);
          });
          msgs.forEach((m) => {
            const existing = map.get(m.id);
            map.set(m.id, { ...(existing || {}), ...m });
          });

          msgs = Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          allIds.forEach((id) => {
            messagesServerStore.set(id, msgs);
          });
        }
      } catch (dbErr) {
        // ignore
      }
    }

    // Filter out deleted messages and deduplicate
    const activeMsgs = msgs.filter((m) => !deletedMessagesServerStore.has(m.id));
    const cleanMsgs: any[] = [];
    const seenMsgIds = new Set<string>();

    for (const m of activeMsgs) {
      if (!m || !m.id) continue;
      const existingIdx = cleanMsgs.findIndex((p) => {
        if (p.id === m.id) return true;
        if (
          p.sender_id === m.sender_id &&
          p.content === m.content &&
          Math.abs(new Date(p.created_at || 0).getTime() - new Date(m.created_at || 0).getTime()) < 45000
        ) {
          return true;
        }
        if (
          p.content?.startsWith('[CALL_LOG:') &&
          m.content?.startsWith('[CALL_LOG:') &&
          Math.abs(new Date(p.created_at || 0).getTime() - new Date(m.created_at || 0).getTime()) < 60000
        ) {
          return true;
        }
        return false;
      });

      if (existingIdx >= 0) {
        const prev = cleanMsgs[existingIdx];
        const isNewAnswered = m.content?.includes(':answered:') && !prev.content?.includes(':answered:');
        const isNewEnded = m.content?.includes(':ended:') && !prev.content?.includes(':ended:');
        cleanMsgs[existingIdx] = {
          ...prev,
          ...m,
          id: isNewAnswered || isNewEnded ? m.id : prev.id,
          content: isNewAnswered || isNewEnded ? m.content : (m.content || prev.content),
        };
        continue;
      }
      if (seenMsgIds.has(m.id)) continue;
      seenMsgIds.add(m.id);
      cleanMsgs.push(m);
    }

    return res.json({ messages: cleanMsgs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list messages' });
  }
});

// 4.b Mark messages as read
app.post('/api/messages/mark-read', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { conversationId, userId } = body || {};
    if (conversationId && userId) {
      const msgs = messagesServerStore.get(conversationId) || [];
      messagesServerStore.set(
        conversationId,
        msgs.map((m) => (m.sender_id !== userId ? { ...m, is_read: true } : m))
      );

      const conv = serverConversationsStore.get(conversationId);
      if (conv) {
        conv.unread_count = 0;
      }

      if (serverSupabase) {
        serverSupabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId)
          .then(() => {})
          .catch(() => {});

        const unreadFromOthers = msgs.filter((m) => m.sender_id !== userId);
        for (const m of unreadFromOthers) {
          serverSupabase
            .from('message_reads')
            .upsert({ message_id: m.id, user_id: userId }, { onConflict: 'message_id,user_id' })
            .then(() => {})
            .catch(() => {});
        }
      }
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// 5. Delete message (single)
app.post('/api/messages/delete', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { conversationId, messageId } = body || {};
    if (!messageId) {
      return res.status(400).json({ error: 'messageId required' });
    }

    deletedMessagesServerStore.add(messageId);

    if (conversationId) {
      const existing = messagesServerStore.get(conversationId) || [];
      const updatedList = existing.filter((m) => m.id !== messageId);
      messagesServerStore.set(conversationId, updatedList);

      const conv = serverConversationsStore.get(conversationId);
      if (conv) {
        if (conv.last_message?.id === messageId) {
          conv.last_message = updatedList.length > 0 ? updatedList[updatedList.length - 1] : undefined;
        }
      }
    } else {
      // Find and remove across any conversation
      for (const [convId, list] of messagesServerStore.entries()) {
        if (list.some((m) => m.id === messageId)) {
          const updatedList = list.filter((m) => m.id !== messageId);
          messagesServerStore.set(convId, updatedList);
          const conv = serverConversationsStore.get(convId);
          if (conv && conv.last_message?.id === messageId) {
            conv.last_message = updatedList.length > 0 ? updatedList[updatedList.length - 1] : undefined;
          }
        }
      }
    }

    if (serverSupabase) {
      serverSupabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .then(() => {})
        .catch(() => {});
    }

    return res.json({ success: true, messageId, conversationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// 5.b Clear all messages in conversation
app.post('/api/messages/clear', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { conversationId } = body || {};
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }

    const existing = messagesServerStore.get(conversationId) || [];
    existing.forEach((m) => {
      if (m.id) deletedMessagesServerStore.add(m.id);
    });

    messagesServerStore.set(conversationId, []);

    const conv = serverConversationsStore.get(conversationId);
    if (conv) {
      conv.last_message = undefined;
    }

    if (serverSupabase) {
      serverSupabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)
        .then(() => {})
        .catch(() => {});
    }

    return res.json({ success: true, conversationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to clear conversation messages' });
  }
});

// 5.c Delete conversation endpoint
app.post('/api/conversations/delete', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const { conversationId } = body || {};
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }

    // 1. Mark conversation in deleted set
    deletedConversationsServerStore.add(conversationId);

    // 2. Clear and delete in-memory messages & conversation
    const existing = messagesServerStore.get(conversationId) || [];
    existing.forEach((m) => {
      if (m.id) deletedMessagesServerStore.add(m.id);
    });
    messagesServerStore.delete(conversationId);
    serverConversationsStore.delete(conversationId);

    // 3. Complete cascading delete in Supabase
    if (serverSupabase) {
      (async () => {
        try {
          await serverSupabase.from('messages').delete().eq('conversation_id', conversationId);
          await serverSupabase.from('conversation_members').delete().eq('conversation_id', conversationId);
          await serverSupabase.from('conversations').delete().eq('id', conversationId);
        } catch (dbErr) {
          // ignore
        }
      })();
    }

    return res.json({ success: true, conversationId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    livekitConfigured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
  });
});

// Secure LiveKit Token Generation Endpoint
// POST /api/livekit/token
app.post('/api/livekit/token', async (req, res) => {
  try {
    const {
      roomName,
      participantName,
      participantIdentity,
      targetIdentity,
      customLiveKitUrl,
      customApiKey,
      customApiSecret,
    } = req.body;

    if (!roomName || !participantIdentity) {
      return res.status(400).json({ error: 'roomName and participantIdentity are required' });
    }

    // Check block status if target user is provided
    if (targetIdentity && targetIdentity !== participantIdentity) {
      if (isBlocked(participantIdentity, targetIdentity)) {
        return res.status(403).json({
          error: 'blocked_user',
          message: 'Communication is blocked between these users.',
        });
      }
    }

    const maxCallDurationSeconds = 7200; // 2 hours free calling session
    const accessType = 'unlimited';

    const apiKey = (process.env.LIVEKIT_API_KEY || customApiKey || '').trim();
    const apiSecret = (process.env.LIVEKIT_API_SECRET || customApiSecret || '').trim();
    const livekitUrl = (
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      process.env.VITE_LIVEKIT_URL ||
      customLiveKitUrl ||
      ''
    ).trim();

    const hasValidLiveKit = Boolean(
      apiKey &&
      apiSecret &&
      livekitUrl &&
      !apiKey.includes('APIhmJHPfYK3EKb') &&
      (livekitUrl.startsWith('wss://') || livekitUrl.startsWith('ws://'))
    );

    if (!hasValidLiveKit) {
      return res.json({
        useWebRTC: true,
        token: null,
        serverUrl: null,
        roomName,
        participantIdentity,
        participantName: participantName || participantIdentity,
        accessType,
        maxCallDurationSeconds,
      });
    }

    // Create secure LiveKit access token with authorized duration
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName || participantIdentity,
      ttl: `${Math.max(60, maxCallDurationSeconds + 60)}s`,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.json({
      token,
      serverUrl: livekitUrl,
      roomName,
      participantIdentity,
      participantName: participantName || participantIdentity,
      accessType,
      maxCallDurationSeconds,
    });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({
      error: 'Failed to generate LiveKit access token',
      details: error.message || String(error),
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // In dev mode, attach Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built dist files
    const cwdDist = path.resolve(process.cwd(), 'dist');
    const localDist = path.resolve(__dirname, 'dist');
    const parentDist = path.resolve(__dirname, '..', 'dist');
    const distPath = fs.existsSync(cwdDist)
      ? cwdDist
      : fs.existsSync(parentDist)
        ? parentDist
        : localDist;

    console.log(`[Production] Serving static client files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('App build not found. Please run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LiveConnect server listening on http://0.0.0.0:${PORT}`);
  });
}

// Always start server when executed directly
startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

export default app;
