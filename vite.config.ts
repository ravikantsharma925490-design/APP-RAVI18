import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { defineConfig, Plugin } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase credentials
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://slvojojyssepcarxlmfd.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdm9qb2p5c3NlcGNhcnhsbWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTkzMTEsImV4cCI6MjEwMjQ5NTMxMX0.9ZVwwycoPtNKo7zQXgkuGnz4xBqnAfUvtHGb47rR0A8';

let devSupabase: any = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    devSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn('Vite Dev Supabase init:', e);
}

// In-memory stores for ultra-fast zero-latency relay
const devFollowsStore = new Set<string>();
const devBlockedStore = new Set<string>();
const devNotificationsStore = new Map<string, any[]>();
const devProfilesStore = new Map<string, any>();

interface DevServerMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  sender?: any;
  is_read?: boolean;
}

interface DevServerConversation {
  id: string;
  type: string;
  member_ids: string[];
  members_meta: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_message?: DevServerMessage;
}

interface DevServerCall {
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

const devConversationsStore = new Map<string, DevServerConversation>();
const devMessagesStore = new Map<string, DevServerMessage[]>();
const devCallsStore = new Map<string, DevServerCall>();
const devSignalsStore = new Map<string, any[]>();

interface DevMediaRecord {
  id: string;
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
  size: number;
  createdAt: string;
  mp3Buffer?: Buffer;
}
const devMediaFilesStore = new Map<string, DevMediaRecord>();

function transcodeAudioToMp3Dev(inputBuffer: Buffer): Promise<Buffer> {
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

const DEV_TRIAL_MS = 30 * 24 * 60 * 60 * 1000; // 30-day trial

// Standard deterministic UUID generator matching useConversations.ts
function getDeterministicDirectConvId(userA: string, userB: string): string {
  const sorted = [userA, userB].sort().join(':');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < sorted.length; i++) {
    const ch = sorted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const p1 = ((h1 >>> 0) & 0xffffffff).toString(16).padStart(8, '0');
  const p2 = (((h1 ^ h2) >>> 0) & 0xffff).toString(16).padStart(4, '0');
  const p3 = '4' + (((h2 >>> 16) & 0x0fff)).toString(16).padStart(3, '0');
  const p4 = '8' + (((h2 >>> 8) & 0x0fff)).toString(16).padStart(3, '0');
  const p5 = (((h2 ^ (h1 >>> 4)) >>> 0) & 0xffffffffffff).toString(16).padStart(12, '0');
  
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val) ? val : null;
}

function devIsBlocked(userA: string, userB: string): boolean {
  if (!userA || !userB) return false;
  return devBlockedStore.has(`${userA}:${userB}`) || devBlockedStore.has(`${userB}:${userA}`);
}

function devIsFollowing(followerId: string, followingId: string): boolean {
  if (!followerId || !followingId) return false;
  return devFollowsStore.has(`${followerId}:${followingId}`);
}

function devIsMutualFollow(userA: string, userB: string): boolean {
  if (!userA || !userB || userA === userB) return false;
  if (devIsBlocked(userA, userB)) return false;
  return devIsFollowing(userA, userB) && devIsFollowing(userB, userA);
}

function devGetFollowCounts(userId: string) {
  let followersCount = 0;
  let followingCount = 0;
  for (const item of devFollowsStore) {
    const [fId, tId] = item.split(':');
    if (tId === userId) followersCount++;
    if (fId === userId) followingCount++;
  }
  return { followersCount, followingCount };
}

function devAddNotification(
  userId: string,
  actorId: string,
  type: string,
  title: string,
  message: string,
  referenceId?: string,
  actorMeta?: any
) {
  if (!userId || !actorId || userId === actorId) return;
  if (devIsBlocked(userId, actorId)) return;

  const validRefId = toUuidOrNull(referenceId) || toUuidOrNull(actorId) || null;

  const currentList = devNotificationsStore.get(userId) || [];
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
    actor: actorMeta || devProfilesStore.get(actorId) || { id: actorId, display_name: 'User', username: 'user' },
  };

  devNotificationsStore.set(userId, [newNotif, ...currentList.slice(0, 99)]);
  return newNotif;
}

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c: any) => (body += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-handler',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // 1. Health check
        if (url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              timestamp: new Date().toISOString(),
              supabaseConnected: Boolean(devSupabase),
              webrtcDirectCalling: true,
            })
          );
          return;
        }

        // ----------------------------------------------------
        // CONVERSATIONS & MESSAGING RELAY ENDPOINTS
        // ----------------------------------------------------

        // 2. Create or Get Direct Conversation
        if (url === '/api/conversations/create-or-get' && req.method === 'POST') {
          const { userId, targetUserId, userProfile, targetProfile } = await parseJsonBody(req);
          if (!userId || !targetUserId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'userId and targetUserId required' }));
            return;
          }

          if (userProfile?.id) devProfilesStore.set(userProfile.id, userProfile);
          if (targetProfile?.id) devProfilesStore.set(targetProfile.id, targetProfile);

          const convId = getDeterministicDirectConvId(userId, targetUserId);
          const nowIso = new Date().toISOString();

          let conv = devConversationsStore.get(convId);
          if (!conv) {
            conv = {
              id: convId,
              type: 'direct',
              member_ids: userId === targetUserId ? [userId] : [userId, targetUserId],
              members_meta: {
                [userId]: userProfile || devProfilesStore.get(userId),
                [targetUserId]: targetProfile || devProfilesStore.get(targetUserId),
              },
              created_at: nowIso,
              updated_at: nowIso,
            };
            devConversationsStore.set(convId, conv);
          }

          // Persist to Supabase in background
          if (devSupabase) {
            (async () => {
              try {
                await devSupabase
                  .from('conversations')
                  .upsert({ id: convId, type: 'direct', updated_at: nowIso }, { onConflict: 'id' });
                await devSupabase
                  .from('conversation_members')
                  .upsert({ conversation_id: convId, user_id: userId }, { onConflict: 'conversation_id,user_id' });
                if (targetUserId !== userId) {
                  await devSupabase
                    .from('conversation_members')
                    .upsert({ conversation_id: convId, user_id: targetUserId }, { onConflict: 'conversation_id,user_id' });
                }
              } catch (e) {
                // ignore
              }
            })();
          }

          const otherMember = targetUserId === userId ? userProfile : targetProfile || devProfilesStore.get(targetUserId);
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              conversation: {
                ...conv,
                other_member: otherMember,
              },
            })
          );
          return;
        }

        // 3. List conversations for user
        if (url === '/api/conversations/list' && req.method === 'POST') {
          const { userId } = await parseJsonBody(req);
          if (!userId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'userId is required' }));
            return;
          }

          const userConvs: any[] = [];
          for (const conv of devConversationsStore.values()) {
            if (conv.member_ids.includes(userId)) {
              const otherId = conv.member_ids.find((id) => id !== userId) || userId;
              const otherProfile = conv.members_meta[otherId] || devProfilesStore.get(otherId);
              const msgs = devMessagesStore.get(conv.id) || [];
              const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : conv.last_message;
              const unreadCount = msgs.filter((m) => m.sender_id !== userId && !m.is_read).length;

              userConvs.push({
                ...conv,
                other_member: otherProfile,
                last_message: lastMsg,
                unread_count: unreadCount,
              });
            }
          }

          userConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ conversations: userConvs }));
          return;
        }

        // 4. Send a Message
        if (url === '/api/messages/send' && req.method === 'POST') {
          const { message, recipientId, senderProfile, recipientProfile } = await parseJsonBody(req);
          if (!message || !message.conversation_id || !message.sender_id || !message.content) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Valid message object required' }));
            return;
          }

          const convId = message.conversation_id;
          const senderId = message.sender_id;
          const nowIso = message.created_at || new Date().toISOString();

          if (senderProfile?.id) devProfilesStore.set(senderProfile.id, senderProfile);
          if (recipientProfile?.id) devProfilesStore.set(recipientProfile.id, recipientProfile);

          const existing = devMessagesStore.get(convId) || [];
          if (!existing.some((m) => m.id === message.id)) {
            devMessagesStore.set(convId, [...existing, { ...message, is_read: false }]);
          }

          // Update conversation in memory
          let conv = devConversationsStore.get(convId);
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
                [senderId]: senderProfile || devProfilesStore.get(senderId),
                ...(recipientId ? { [recipientId]: recipientProfile || devProfilesStore.get(recipientId) } : {}),
              },
              created_at: nowIso,
              updated_at: nowIso,
              last_message: message,
            };
            devConversationsStore.set(convId, conv);
          }

          let targetRecipient = recipientId;
          if (!targetRecipient && conv) {
            targetRecipient = conv.member_ids.find((id) => id !== senderId);
          }

          // Send in-app notification to receiver
          if (targetRecipient && targetRecipient !== senderId) {
            const senderName =
              senderProfile?.display_name ||
              senderProfile?.username ||
              devProfilesStore.get(senderId)?.display_name ||
              'Someone';

            devAddNotification(
              targetRecipient,
              senderId,
              'message',
              `New message from ${senderName}`,
              message.content,
              convId,
              senderProfile || devProfilesStore.get(senderId)
            );
          }

          // Sync to Supabase in background
          if (devSupabase) {
            (async () => {
              try {
                await devSupabase
                  .from('conversations')
                  .upsert({ id: convId, type: 'direct', updated_at: nowIso }, { onConflict: 'id' });

                await devSupabase
                  .from('conversation_members')
                  .upsert({ conversation_id: convId, user_id: senderId }, { onConflict: 'conversation_id,user_id' });

                if (targetRecipient && targetRecipient !== senderId) {
                  await devSupabase
                    .from('conversation_members')
                    .upsert({ conversation_id: convId, user_id: targetRecipient }, { onConflict: 'conversation_id,user_id' });
                }

                await devSupabase
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
                // quiet
              }
            })();
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message }));
          return;
        }

        // 5. List messages for a conversation
        if (url === '/api/messages/list' && req.method === 'POST') {
          const { conversationId, candidateIds, userId } = await parseJsonBody(req);
          if (!conversationId && (!Array.isArray(candidateIds) || candidateIds.length === 0)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'conversationId is required' }));
            return;
          }

          const allIds: string[] = Array.from(
            new Set([conversationId, ...(Array.isArray(candidateIds) ? candidateIds : [])].filter(Boolean))
          );

          const memoryMap = new Map<string, any>();
          allIds.forEach((id) => {
            const stored = devMessagesStore.get(id) || [];
            stored.forEach((m) => memoryMap.set(m.id, m));
          });
          let msgs = Array.from(memoryMap.values());

          if (devSupabase) {
            try {
              const { data: dbMsgs } = await devSupabase
                .from('messages')
                .select('*, sender:profiles(*)')
                .in('conversation_id', allIds)
                .order('created_at', { ascending: true })
                .limit(200);
              if (Array.isArray(dbMsgs) && dbMsgs.length > 0) {
                dbMsgs.forEach((m) => memoryMap.set(m.id, m));
                msgs = Array.from(memoryMap.values()).sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                allIds.forEach((id) => devMessagesStore.set(id, msgs));
              }
            } catch (e) {}
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ messages: msgs }));
          return;
        }

        // 5.b Mark messages in a conversation as read
        if (url === '/api/messages/mark-read' && req.method === 'POST') {
          const { conversationId, userId } = await parseJsonBody(req);
          if (conversationId && userId) {
            const msgs = devMessagesStore.get(conversationId) || [];
            devMessagesStore.set(
              conversationId,
              msgs.map((m) => (m.sender_id !== userId ? { ...m, is_read: true } : m))
            );

            // Sync to Supabase message_reads
            if (devSupabase) {
              const unreadFromOthers = msgs.filter((m) => m.sender_id !== userId);
              for (const m of unreadFromOthers) {
                devSupabase
                  .from('message_reads')
                  .upsert({ message_id: m.id, user_id: userId }, { onConflict: 'message_id,user_id' })
                  .then(() => {})
                  .catch(() => {});
              }
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // ----------------------------------------------------
        // CALL SIGNALING RELAY ENDPOINTS
        // ----------------------------------------------------

        // 6. Create / Dispatch Call (handles both /api/calls/create and /api/calls/initiate)
        if ((url === '/api/calls/create' || url === '/api/calls/initiate') && req.method === 'POST') {
          const { call, callerMeta } = await parseJsonBody(req);
          if (!call || !call.id || !call.caller_id || !call.callee_id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Valid call object with caller_id and callee_id required' }));
            return;
          }

          if (devIsBlocked(call.caller_id, call.callee_id)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Cannot call blocked user' }));
            return;
          }

          // Auto-link users as mutual follows upon placing a call
          if (call.caller_id !== call.callee_id) {
            devFollowsStore.add(`${call.caller_id}:${call.callee_id}`);
            devFollowsStore.add(`${call.callee_id}:${call.caller_id}`);
          }

          const callerObj = callerMeta || devProfilesStore.get(call.caller_id) || {
            id: call.caller_id,
            display_name: 'Caller',
            username: 'caller',
          };

          const callRecord: DevServerCall = {
            id: call.id,
            caller_id: call.caller_id,
            callee_id: call.callee_id,
            callerDeviceId: call.callerDeviceId,
            calleeDeviceId: call.calleeDeviceId,
            call_type: call.call_type || 'audio',
            status: 'calling',
            room_name: call.room_name || `room_${call.id}`,
            caller: callerObj,
            created_at: call.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            answered_at: null,
            ended_at: null,
          };

          devCallsStore.set(call.id, callRecord);

          // Notify callee
          const callerName = callerObj.display_name || callerObj.username || 'Someone';
          devAddNotification(
            call.callee_id,
            call.caller_id,
            'call',
            `Incoming ${call.call_type === 'video' ? 'Video' : 'Voice'} Call`,
            `${callerName} is calling you...`,
            call.id,
            callerObj
          );

          // Save call to Supabase
          if (devSupabase) {
            devSupabase
              .from('calls')
              .upsert({
                id: call.id,
                caller_id: call.caller_id,
                callee_id: call.callee_id,
                call_type: call.call_type || 'audio',
                status: 'calling',
                room_name: callRecord.room_name,
                created_at: callRecord.created_at,
                updated_at: callRecord.updated_at,
              }, { onConflict: 'id' })
              .then(() => {})
              .catch(() => {});
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, call: callRecord }));
          return;
        }

        // 7. Check incoming calls for user (with device & cross-device support)
        if (url === '/api/calls/incoming' && req.method === 'POST') {
          const { userId, username, deviceId } = await parseJsonBody(req);
          if (!userId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'userId is required' }));
            return;
          }

          const now = Date.now();
          const incoming: DevServerCall[] = [];

          // 1. Search in-memory store
          for (const call of devCallsStore.values()) {
            // If this device initiated the call, don't ring itself
            if (deviceId && call.callerDeviceId && call.callerDeviceId === deviceId) {
              continue;
            }

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
              if (age < 90000 && (call.status === 'calling' || call.status === 'ringing')) {
                incoming.push(call);
              }
            }
          }

          // 2. Fallback to Supabase if empty in-memory
          if (incoming.length === 0 && devSupabase) {
            try {
              const sixtySecsAgo = new Date(Date.now() - 90000).toISOString();
              const { data: dbCalls } = await devSupabase
                .from('calls')
                .select('*')
                .eq('callee_id', userId)
                .in('status', ['calling', 'ringing'])
                .gte('created_at', sixtySecsAgo)
                .order('created_at', { ascending: false })
                .limit(5);

              if (Array.isArray(dbCalls) && dbCalls.length > 0) {
                for (const dbCall of dbCalls) {
                  const callerP = devProfilesStore.get(dbCall.caller_id) || {
                    id: dbCall.caller_id,
                    username: 'caller',
                    display_name: 'Caller',
                  };
                  const memoryCall: DevServerCall = {
                    id: dbCall.id,
                    caller_id: dbCall.caller_id,
                    callee_id: dbCall.callee_id,
                    call_type: dbCall.call_type || 'audio',
                    status: dbCall.status,
                    room_name: dbCall.room_name || `room_${dbCall.id}`,
                    caller: callerP,
                    created_at: dbCall.created_at,
                    updated_at: dbCall.updated_at,
                  };
                  devCallsStore.set(dbCall.id, memoryCall);
                  incoming.push(memoryCall);
                }
              }
            } catch (dbErr) {
              // ignore
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ calls: incoming }));
          return;
        }

        // 8. Call Action (ring, accept, reject, end, cancel)
        if (url === '/api/calls/action' && req.method === 'POST') {
          const { callId, action, userId, calleeDeviceId } = await parseJsonBody(req);
          if (!callId || !action) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'callId and action are required' }));
            return;
          }

          let call = devCallsStore.get(callId);
          const nowIso = new Date().toISOString();

          let newStatus = call ? call.status : 'ringing';
          if (action === 'ring') newStatus = 'ringing';
          if (action === 'accept') newStatus = 'accepted';
          if (action === 'reject') newStatus = 'rejected';
          if (action === 'cancel') newStatus = 'cancelled';
          if (action === 'end') newStatus = 'ended';

          if (call) {
            call.status = newStatus as any;
            call.updated_at = nowIso;
            if (calleeDeviceId) call.calleeDeviceId = calleeDeviceId;
            if (action === 'accept') call.answered_at = nowIso;
            if (['ended', 'rejected', 'cancelled'].includes(action)) call.ended_at = nowIso;
          } else {
            // Register call in store with this new status
            const newCallObj: DevServerCall = {
              id: callId,
              caller_id: userId || 'caller',
              callee_id: 'unknown',
              calleeDeviceId,
              call_type: 'audio',
              status: newStatus as any,
              room_name: `room_${callId}`,
              created_at: nowIso,
              updated_at: nowIso,
              answered_at: action === 'accept' ? nowIso : null,
              ended_at: ['ended', 'rejected', 'cancelled'].includes(action) ? nowIso : null,
            };
            devCallsStore.set(callId, newCallObj);
          }

          // Sync to Supabase
          if (devSupabase) {
            devSupabase
              .from('calls')
              .update({
                status: newStatus,
                updated_at: nowIso,
                ...(action === 'accept' ? { answered_at: nowIso } : {}),
                ...(['ended', 'rejected', 'cancelled'].includes(action) ? { ended_at: nowIso } : {}),
              })
              .eq('id', callId)
              .then(() => {})
              .catch(() => {});
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, status: newStatus, call: devCallsStore.get(callId) }));
          return;
        }

        // 9. Call status check (authoritative check)
        if (url === '/api/calls/status' && req.method === 'POST') {
          const { callId } = await parseJsonBody(req);
          if (!callId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'callId is required' }));
            return;
          }

          const call = devCallsStore.get(callId);
          if (call) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ exists: true, status: call.status, call }));
            return;
          }

          // Check Supabase if not in memory
          if (devSupabase) {
            try {
              const { data: dbCall } = await devSupabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

              if (dbCall) {
                const memCall: DevServerCall = {
                  id: dbCall.id,
                  caller_id: dbCall.caller_id,
                  callee_id: dbCall.callee_id,
                  call_type: dbCall.call_type || 'audio',
                  status: dbCall.status,
                  room_name: dbCall.room_name,
                  created_at: dbCall.created_at,
                  updated_at: dbCall.updated_at,
                  answered_at: dbCall.answered_at,
                  ended_at: dbCall.ended_at,
                };
                devCallsStore.set(dbCall.id, memCall);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ exists: true, status: dbCall.status, call: dbCall }));
                return;
              }
            } catch (dbErr) {
              // ignore
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ exists: false, status: 'unknown', call: null }));
          return;
        }

        // 10. Call History list
        if (url === '/api/calls/history' && req.method === 'POST') {
          const { userId } = await parseJsonBody(req);
          if (!userId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'userId is required' }));
            return;
          }

          const userCalls: any[] = [];
          for (const call of devCallsStore.values()) {
            if (call.caller_id === userId || call.callee_id === userId) {
              const isOutgoing = call.caller_id === userId;
              const peerId = isOutgoing ? call.callee_id : call.caller_id;
              const peer =
                (isOutgoing ? null : call.caller) ||
                devProfilesStore.get(peerId) || {
                  id: peerId,
                  username: 'user',
                  display_name: 'Contact',
                  avatar_url: null,
                };

              userCalls.push({
                ...call,
                peer,
                caller: call.caller || devProfilesStore.get(call.caller_id) || {
                  id: call.caller_id,
                  username: 'caller',
                  display_name: 'Caller',
                },
                direction: isOutgoing ? 'outgoing' : 'incoming',
              });
            }
          }

          // Sort newest first
          userCalls.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ calls: userCalls }));
          return;
        }

        // 11. Send Call Signal (Offer, Answer, ICE Candidate)
        if (url === '/api/calls/signal' && req.method === 'POST') {
          const signal = await parseJsonBody(req);
          if (signal && signal.callId) {
            const payload = {
              ...signal,
              id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            };

            if (signal.targetDeviceId) {
              const devKey = `${signal.callId}_${signal.targetDeviceId}`;
              const existing = devSignalsStore.get(devKey) || [];
              devSignalsStore.set(devKey, [...existing.slice(-40), payload]);
            }

            if (signal.targetId) {
              const userKey = `${signal.callId}_${signal.targetId}`;
              const existing = devSignalsStore.get(userKey) || [];
              devSignalsStore.set(userKey, [...existing.slice(-40), payload]);
            }

            // Also store under callId as shared bus
            const globalKey = `call_${signal.callId}`;
            const globalExisting = devSignalsStore.get(globalKey) || [];
            devSignalsStore.set(globalKey, [...globalExisting.slice(-40), payload]);
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // 12. Retrieve Pending Call Signals
        if (url === '/api/calls/signals' && req.method === 'POST') {
          const { callId, targetId, deviceId } = await parseJsonBody(req);
          if (!callId) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ signals: [] }));
            return;
          }

          const collected: any[] = [];
          const seenIds = new Set<string>();

          const checkKey = (key: string) => {
            const list = devSignalsStore.get(key) || [];
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

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ signals: collected }));
          return;
        }

        // 12.b. WebRTC ICE & TURN Servers Endpoint
        if (url === '/api/webrtc/ice-servers' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:stun.services.mozilla.com' },
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
              ],
            })
          );
          return;
        }

        // ----------------------------------------------------
        // RELATIONS & PROFILE ENDPOINTS
        // ----------------------------------------------------
        if (url === '/api/relations/status' && req.method === 'POST') {
          const { userId, targetUserId } = await parseJsonBody(req);
          const isFollowingThem = devIsFollowing(userId, targetUserId);
          const isFollowedByThem = devIsFollowing(targetUserId, userId);
          const isMutual = devIsMutualFollow(userId, targetUserId);
          const isBlockedByMe = devBlockedStore.has(`${userId}:${targetUserId}`);
          const isBlockedByThem = devBlockedStore.has(`${targetUserId}:${userId}`);
          const counts = devGetFollowCounts(targetUserId);

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              isFollowing: isFollowingThem,
              isFollowedBy: isFollowedByThem,
              isMutual,
              isBlockedByMe,
              isBlockedByThem,
              isBlocked: isBlockedByMe || isBlockedByThem,
              followersCount: counts.followersCount,
              followingCount: counts.followingCount,
            })
          );
          return;
        }

        if (url === '/api/relations/follow' && req.method === 'POST') {
          const { userId, targetUserId, userMeta } = await parseJsonBody(req);
          if (userId && targetUserId) {
            devFollowsStore.add(`${userId}:${targetUserId}`);
            if (userMeta?.id) devProfilesStore.set(userMeta.id, userMeta);
            if (devSupabase) {
              devSupabase
                .from('follows')
                .upsert({ follower_id: userId, following_id: targetUserId }, { onConflict: 'follower_id,following_id' })
                .then(() => {})
                .catch(() => {});
            }
          }
          const counts = devGetFollowCounts(targetUserId);
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              isFollowing: true,
              followersCount: counts.followersCount,
              followingCount: counts.followingCount,
            })
          );
          return;
        }

        if (url === '/api/relations/unfollow' && req.method === 'POST') {
          const { userId, targetUserId } = await parseJsonBody(req);
          if (userId && targetUserId) {
            devFollowsStore.delete(`${userId}:${targetUserId}`);
            if (devSupabase) {
              devSupabase
                .from('follows')
                .delete()
                .match({ follower_id: userId, following_id: targetUserId })
                .then(() => {})
                .catch(() => {});
            }
          }
          const counts = devGetFollowCounts(targetUserId);
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              isFollowing: false,
              followersCount: counts.followersCount,
              followingCount: counts.followingCount,
            })
          );
          return;
        }

        if (url === '/api/relations/block' && req.method === 'POST') {
          const { userId, targetUserId } = await parseJsonBody(req);
          if (userId && targetUserId) {
            devBlockedStore.add(`${userId}:${targetUserId}`);
            devFollowsStore.delete(`${userId}:${targetUserId}`);
            devFollowsStore.delete(`${targetUserId}:${userId}`);
            if (devSupabase) {
              devSupabase
                .from('blocked_users')
                .upsert({ blocker_id: userId, blocked_id: targetUserId }, { onConflict: 'blocker_id,blocked_id' })
                .then(() => {})
                .catch(() => {});
              devSupabase
                .from('follows')
                .delete()
                .or(`and(follower_id.eq.${userId},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${userId})`)
                .then(() => {})
                .catch(() => {});
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, isBlocked: true }));
          return;
        }

        if (url === '/api/relations/unblock' && req.method === 'POST') {
          const { userId, targetUserId } = await parseJsonBody(req);
          if (userId && targetUserId) {
            devBlockedStore.delete(`${userId}:${targetUserId}`);
            if (devSupabase) {
              devSupabase
                .from('blocked_users')
                .delete()
                .match({ blocker_id: userId, blocked_id: targetUserId })
                .then(() => {})
                .catch(() => {});
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, isBlocked: false }));
          return;
        }

        if (url === '/api/relations/user-overview' && req.method === 'POST') {
          const { userId } = await parseJsonBody(req);
          const following: string[] = [];
          const followers: string[] = [];
          if (userId) {
            for (const item of devFollowsStore) {
              const [f, t] = item.split(':');
              if (f === userId) following.push(t);
              if (t === userId) followers.push(f);
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ following, followers }));
          return;
        }

        if (url === '/api/relations/all-counts' && req.method === 'GET') {
          const counts: Record<string, { followers: number; following: number }> = {};
          for (const item of devFollowsStore) {
            const [f, t] = item.split(':');
            if (f && t) {
              if (!counts[f]) counts[f] = { followers: 0, following: 0 };
              if (!counts[t]) counts[t] = { followers: 0, following: 0 };
              counts[f].following += 1;
              counts[t].followers += 1;
            }
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ counts }));
          return;
        }

        // ----------------------------------------------------
        // NOTIFICATIONS
        // ----------------------------------------------------
        if (url === '/api/notifications/list' && req.method === 'POST') {
          const { userId } = await parseJsonBody(req);
          const notifs = devNotificationsStore.get(userId) || [];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ notifications: notifs, unreadCount: notifs.filter((n) => !n.is_read).length }));
          return;
        }

        if (url === '/api/notifications/mark-read' && req.method === 'POST') {
          const { userId, notificationId } = await parseJsonBody(req);
          const notifs = devNotificationsStore.get(userId) || [];
          devNotificationsStore.set(userId, notifs.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (url === '/api/notifications/mark-all-read' && req.method === 'POST') {
          const { userId } = await parseJsonBody(req);
          const notifs = devNotificationsStore.get(userId) || [];
          devNotificationsStore.set(userId, notifs.map((n) => ({ ...n, is_read: true })));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // ----------------------------------------------------
        // MEDIA STORAGE & STREAMING ENDPOINTS
        // ----------------------------------------------------
        if (url === '/api/media/upload' && req.method === 'POST') {
          const { base64Data, mimeType, fileName, mediaType } = await parseJsonBody(req);
          if (!base64Data) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'base64Data is required' }));
            return;
          }

          const rawType = mimeType || (mediaType === 'audio' ? 'audio/webm' : 'image/jpeg');
          let type = rawType.split(';')[0].trim().toLowerCase();
          let buffer = Buffer.from(base64Data, 'base64');
          let ext = 'bin';

          // If audio (voice note / sound clip), automatically transcode to standard MP3 for universal playback
          const isAudio = mediaType === 'audio' || type.startsWith('audio/') || type.includes('webm') || type.includes('opus') || type.includes('ogg');
          if (isAudio) {
            try {
              const mp3Buffer = await transcodeAudioToMp3Dev(buffer);
              if (mp3Buffer && mp3Buffer.length > 0) {
                buffer = mp3Buffer;
                type = 'audio/mpeg';
                ext = 'mp3';
              }
            } catch (tErr) {
              console.warn('Dev audio transcode notice on upload:', tErr);
            }
          }

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
          
          devMediaFilesStore.set(fileId, {
            id: fileId,
            buffer,
            mimeType: type,
            fileName: fileName || fileId,
            size: buffer.length,
            createdAt: new Date().toISOString(),
            mp3Buffer: ext === 'mp3' ? buffer : undefined,
          });

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

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              url: `/api/media/file/${fileId}`,
              fileId,
              mimeType: type,
              size: buffer.length,
            })
          );
          return;
        }

        // Transcode endpoint for recovering arbitrary audio files or data URLs to standard MP3
        if (url === '/api/media/transcode' && req.method === 'POST') {
          const { base64Data, fileId } = await parseJsonBody(req);
          let inputBuf: Buffer | null = null;
          if (base64Data) {
            inputBuf = Buffer.from(base64Data, 'base64');
          } else if (fileId) {
            const rec = devMediaFilesStore.get(fileId);
            if (rec) inputBuf = rec.buffer;
            else {
              const diskPath = path.join(process.cwd(), 'uploads', fileId);
              if (fs.existsSync(diskPath)) inputBuf = fs.readFileSync(diskPath);
            }
          }

          if (!inputBuf || inputBuf.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Valid audio data or fileId required' }));
            return;
          }

          try {
            const mp3Buf = await transcodeAudioToMp3Dev(inputBuf);
            const newFileId = `audio_transcoded_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.mp3`;
            devMediaFilesStore.set(newFileId, {
              id: newFileId,
              buffer: mp3Buf,
              mimeType: 'audio/mpeg',
              fileName: newFileId,
              size: mp3Buf.length,
              createdAt: new Date().toISOString(),
              mp3Buffer: mp3Buf,
            });

            try {
              const uploadsDir = path.join(process.cwd(), 'uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
              fs.writeFileSync(path.join(uploadsDir, newFileId), mp3Buf);
            } catch {}

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                url: `/api/media/file/${newFileId}`,
                fileId: newFileId,
                mimeType: 'audio/mpeg',
                size: mp3Buf.length,
              })
            );
          } catch (tErr: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Transcode failed' }));
          }
          return;
        }

        if (url?.startsWith('/api/media/file/') && (req.method === 'GET' || req.method === 'HEAD')) {
          const fileId = url.replace('/api/media/file/', '');
          let record = devMediaFilesStore.get(fileId);

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
                devMediaFilesStore.set(fileId, record);
              }
            } catch (diskReadErr) {
              console.warn('Disk media read notice:', diskReadErr);
            }
          }

          if (!record) {
            res.statusCode = 404;
            res.end('Media file not found');
            return;
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
              const mp3Buf = await transcodeAudioToMp3Dev(record.buffer);
              if (mp3Buf && mp3Buf.length > 0) {
                record.mp3Buffer = mp3Buf;
              }
            } catch (transcodeErr) {
              console.warn('Dev on-demand transcode notice:', transcodeErr);
            }
          }

          const activeBuffer = record.mp3Buffer || record.buffer;
          const activeMime = record.mp3Buffer ? 'audio/mpeg' : cleanMime;
          const totalSize = activeBuffer.length;

          if (req.method === 'HEAD') {
            res.writeHead(200, {
              'Content-Length': totalSize,
              'Content-Type': activeMime,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable',
            });
            res.end();
            return;
          }

          if (totalSize === 0) {
            res.writeHead(200, {
              'Content-Length': 0,
              'Content-Type': activeMime,
              'Accept-Ranges': 'bytes',
            });
            res.end();
            return;
          }

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
            res.end(activeBuffer.subarray(start, end + 1));
            return;
          }

          res.writeHead(200, {
            'Content-Length': totalSize,
            'Content-Type': activeMime,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          res.end(activeBuffer);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
