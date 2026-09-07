import fs from 'fs';
import path from 'path';
import {
  LiveRoom,
  LiveVoiceSeat,
  LiveChatMessage,
  LiveRoomMusicState,
  LiveRoomActivity,
  LiveGiftEvent,
  LIVE_GIFT_CATALOG,
} from '../../types/live';
import { Profile } from '../../types';

// In-memory global store for active live rooms
export const liveRoomsStore = new Map<string, LiveRoom>();
export const liveRoomChatStore = new Map<string, LiveChatMessage[]>();
export const liveRoomReactionsStore = new Map<string, Array<{ id: string; emoji: string; x: number; senderName: string; timestamp: number }>>();
export const liveGiftEventsStore = new Map<string, LiveGiftEvent[]>();
export const userCoinBalancesStore = new Map<string, number>();
export const liveRoomSignalsStore = new Map<string, any[]>(); // `${roomId}_${targetUserId}` -> Signal[]

const STORAGE_FILE = path.resolve(process.cwd(), '.live_rooms_data.json');

// Load persisted rooms from disk on startup
function loadPersistedRooms() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.rooms)) {
        for (const room of data.rooms) {
          if (room && room.id && !room.isClosed) {
            liveRoomsStore.set(room.id, room);
          }
        }
      }
      if (data.coinBalances && typeof data.coinBalances === 'object') {
        for (const [userId, bal] of Object.entries(data.coinBalances)) {
          userCoinBalancesStore.set(userId, Number(bal));
        }
      }
    }
  } catch (err) {
    console.warn('Could not read persisted live rooms:', err);
  }
}

// Persist real rooms to disk
export function persistLiveRoomsToDisk() {
  try {
    const rooms = Array.from(liveRoomsStore.values()).filter((r) => !r.isClosed);
    const coinBalances: Record<string, number> = {};
    for (const [uid, bal] of userCoinBalancesStore.entries()) {
      coinBalances[uid] = bal;
    }
    fs.writeFileSync(
      STORAGE_FILE,
      JSON.stringify({ rooms, coinBalances, savedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn('Could not persist live rooms to disk:', err);
  }
}

// Initialize on module load
loadPersistedRooms();

// Recalculate engagement score based on real user activity
export function recalculateEngagement(room: LiveRoom): number {
  const seatsOccupied = room.seats.filter((s) => s.user !== null).length;
  const chats = liveRoomChatStore.get(room.id) || [];
  const reactions = liveRoomReactionsStore.get(room.id) || [];
  const gifts = liveGiftEventsStore.get(room.id) || [];

  const score =
    room.onlineCount * 5 +
    seatsOccupied * 50 +
    chats.length * 3 +
    reactions.length * 1 +
    gifts.length * 10 +
    (room.currentMusic?.isPlaying ? 25 : 0) +
    (room.currentActivity?.isActive ? 40 : 0);

  room.engagementScore = score;
  return score;
}

// Get all real live rooms (NO fake mock seed data)
export function getAllLiveRooms(): LiveRoom[] {
  const rooms = Array.from(liveRoomsStore.values()).filter((r) => !r.isClosed);
  rooms.forEach((r) => recalculateEngagement(r));
  return rooms;
}

// Get room by ID or 6-digit Room ID
export function getLiveRoomByIdOrRoomId(identifier: string): LiveRoom | null {
  if (!identifier) return null;
  if (liveRoomsStore.has(identifier)) {
    return liveRoomsStore.get(identifier)!;
  }
  for (const r of liveRoomsStore.values()) {
    if (r.roomId === identifier || r.id === identifier) {
      return r;
    }
  }
  return null;
}

// Generate unique 6-digit Room ID
export function generateUniqueRoomId(): string {
  let candidate = '';
  let exists = true;
  while (exists) {
    candidate = String(Math.floor(100000 + Math.random() * 900000));
    exists = Array.from(liveRoomsStore.values()).some((r) => r.roomId === candidate);
  }
  return candidate;
}

// Create a real Live Room initiated by a real user
export function createNewLiveRoom(params: {
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  photoUrl?: string | null;
  owner: Profile;
  isPrivate?: boolean;
}): LiveRoom {
  const id = `live_room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const roomId = generateUniqueRoomId();

  // Create 8 authentic seats: Seat 0 is assigned to the creator, seats 1-7 are open for real users
  const seats: LiveVoiceSeat[] = [];
  for (let i = 0; i < 8; i++) {
    if (i === 0) {
      seats.push({
        seatIndex: 0,
        user: params.owner,
        isMuted: false,
        isSpeaking: false,
        isLocked: false,
        joinedAt: new Date().toISOString(),
      });
    } else {
      seats.push({
        seatIndex: i,
        user: null,
        isMuted: false,
        isSpeaking: false,
        isLocked: false,
      });
    }
  }

  const room: LiveRoom = {
    id,
    roomId,
    name: params.name,
    description: params.description || `Welcome to ${params.owner.display_name}'s live voice room!`,
    category: (params.category as any) || 'chat',
    tags: params.tags && params.tags.length > 0 ? params.tags : ['live', 'voice', params.category || 'chat'],
    photoUrl: params.photoUrl || null,
    ownerId: params.owner.id,
    owner: params.owner,
    adminId: null,
    admin: null,
    adminPermissions: {
      canMute: true,
      canKick: true,
      canBan: false,
      canLockSeats: true,
      canPlayMusic: false,
      canManageGames: true,
    },
    seats,
    audience: [],
    onlineCount: 1,
    bannedUserIds: [],
    mutedUserIds: [],
    isPrivate: Boolean(params.isPrivate),
    pendingJoinRequests: [],
    currentMusic: null,
    currentActivity: null,
    engagementScore: 100,
    isClosed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  liveRoomsStore.set(id, room);
  liveRoomChatStore.set(id, [
    {
      id: `chat_${Date.now()}`,
      roomId: id,
      sender: params.owner,
      content: `🔴 Room "${params.name}" (ID: ${roomId}) is now LIVE! Feel free to take a seat and speak.`,
      type: 'system',
      createdAt: new Date().toISOString(),
    },
  ]);

  persistLiveRoomsToDisk();
  return room;
}
