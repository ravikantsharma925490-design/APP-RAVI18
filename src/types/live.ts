import { Profile } from './index';

export type LiveRoomCategory =
  | 'all'
  | 'chat'
  | 'music'
  | 'gaming'
  | 'hangout'
  | 'poetry'
  | 'friendship'
  | 'debate'
  | 'learning'
  | 'night';

export interface LiveVoiceSeat {
  seatIndex: number; // 0 through 7 (Displayed as Seat 1 - 8)
  user: Profile | null;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocked: boolean;
  joinedAt?: string;
}

export interface LiveRoomAdminPermissions {
  canMute: boolean;
  canKick: boolean;
  canBan: boolean;
  canLockSeats: boolean;
  canPlayMusic: boolean;
  canManageGames: boolean;
}

export interface LiveRoomMusicState {
  songTitle: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playedBy: { id: string; name: string };
  updatedAt: number;
}

export type LiveActivityType = 'quiz' | 'emoji_guess' | 'word_game' | 'poll';

export interface LiveQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  timeLimitSeconds: number;
}

export interface LiveRoomActivity {
  id: string;
  type: LiveActivityType;
  title: string;
  startedBy: { id: string; name: string };
  startedAt: string;
  data: any; // Quiz question, emoji clue, poll options
  votes?: Record<string, number>; // userId -> option index for poll
  answeredUsers?: Record<string, { optionIndex: number; isCorrect: boolean; timeMs: number }>;
  isActive: boolean;
}

export interface LiveRoom {
  id: string; // Internal id
  roomId: string; // Unique 6-digit or formatted Room ID (e.g. "849201")
  name: string;
  description: string;
  category: LiveRoomCategory;
  tags: string[];
  photoUrl?: string | null;
  ownerId: string;
  owner: Profile;
  adminId: string | null;
  admin: Profile | null;
  adminPermissions: LiveRoomAdminPermissions;
  seats: LiveVoiceSeat[]; // Exactly 8 seats
  audience: Profile[];
  onlineCount: number;
  bannedUserIds: string[];
  mutedUserIds: string[];
  isPrivate: boolean;
  pendingJoinRequests: Array<{ user: Profile; requestedAt: string }>;
  currentMusic?: LiveRoomMusicState | null;
  currentActivity?: LiveRoomActivity | null;
  engagementScore: number; // Calculated dynamically from talk time, audience, chat, reactions
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiveChatMessage {
  id: string;
  roomId: string;
  sender: Profile;
  content: string;
  type: 'text' | 'gift' | 'system' | 'action' | 'game';
  giftMeta?: {
    giftId: string;
    giftName: string;
    giftIcon: string;
    coinCost: number;
    recipientId: string;
    recipientName: string;
  };
  createdAt: string;
  badge?: 'owner' | 'admin' | 'seat' | 'vip' | null;
}

export interface LiveGift {
  id: string;
  name: string;
  coins: number;
  icon: string;
  category: 'popular' | 'luxury' | 'romantic' | 'fun' | 'special';
  description: string;
  animationType:
    | 'teddy'
    | 'panda'
    | 'rose'
    | 'heart'
    | 'star'
    | 'crown'
    | 'cake'
    | 'unicorn'
    | 'party'
    | 'rocket'
    | 'rainbow'
    | 'butterfly'
    | 'giftbox';
}

export interface LiveGiftEvent {
  id: string;
  gift: LiveGift;
  sender: Profile;
  recipient: Profile;
  roomId: string;
  targetSeatIndex?: number;
  timestamp: number;
}

export interface CoinPackage {
  id: string;
  coins: number;
  bonusCoins: number;
  priceUsd: number;
  popular?: boolean;
  bestValue?: boolean;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  type: 'purchase' | 'gift_sent' | 'gift_received' | 'reward';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  metadata?: any;
}

export interface UserAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

export interface UserLiveStats {
  userId: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  specialId: string; // Live Room Special ID Label (e.g. "LV-94821")
  coinsBalance: number;
  giftsSentCount: number;
  giftsReceivedCount: number;
  coinsSentTotal: number;
  coinsReceivedTotal: number;
  roomsHostedCount: number;
  timeSpentMinutes: number;
  quizzesWonCount: number;
  badges: string[];
  achievements: UserAchievement[];
}

export const LIVE_GIFT_CATALOG: LiveGift[] = [
  {
    id: 'teddy',
    name: 'Teddy',
    coins: 10,
    icon: '🧸',
    category: 'fun',
    description: 'A cute cuddly teddy bear with warm hugs',
    animationType: 'teddy',
  },
  {
    id: 'panda',
    name: 'Panda',
    coins: 20,
    icon: '🐼',
    category: 'fun',
    description: 'An adorable rolling panda with bamboo hearts',
    animationType: 'panda',
  },
  {
    id: 'rose',
    name: 'Rose',
    coins: 50,
    icon: '🌹',
    category: 'romantic',
    description: 'A blooming scarlet rose shower',
    animationType: 'rose',
  },
  {
    id: 'heart',
    name: 'Heart',
    coins: 100,
    icon: '💖',
    category: 'romantic',
    description: 'A radiant pulsating lover heart burst',
    animationType: 'heart',
  },
  {
    id: 'star',
    name: 'Star',
    coins: 150,
    icon: '⭐',
    category: 'popular',
    description: 'Golden shooting stars across the room',
    animationType: 'star',
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    coins: 250,
    icon: '🦋',
    category: 'romantic',
    description: 'Glowing sapphire butterflies flutter',
    animationType: 'butterfly',
  },
  {
    id: 'cake',
    name: 'Cake',
    coins: 300,
    icon: '🎂',
    category: 'fun',
    description: 'Celebratory birthday feast with sparklers',
    animationType: 'cake',
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    coins: 500,
    icon: '🌈',
    category: 'special',
    description: 'A vivid neon rainbow arching the stage',
    animationType: 'rainbow',
  },
  {
    id: 'giftbox',
    name: 'Gift Box',
    coins: 750,
    icon: '🎁',
    category: 'special',
    description: 'Mystery sparkling present box with surprise fireworks',
    animationType: 'giftbox',
  },
  {
    id: 'crown',
    name: 'Crown',
    coins: 1000,
    icon: '👑',
    category: 'luxury',
    description: 'Royal imperial crown with diamond glitter',
    animationType: 'crown',
  },
  {
    id: 'party',
    name: 'Party',
    coins: 1500,
    icon: '🎉',
    category: 'popular',
    description: 'Mega party confetti cannon and disco blast',
    animationType: 'party',
  },
  {
    id: 'unicorn',
    name: 'Unicorn',
    coins: 2000,
    icon: '🦄',
    category: 'luxury',
    description: 'Magical celestial unicorn with star horn beam',
    animationType: 'unicorn',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    coins: 5000,
    icon: '🚀',
    category: 'luxury',
    description: 'Hyper-drive rocket takeoff blasting into space',
    animationType: 'rocket',
  },
];

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pack_100', coins: 100, bonusCoins: 0, priceUsd: 0.99 },
  { id: 'pack_550', coins: 500, bonusCoins: 50, priceUsd: 4.99, popular: true },
  { id: 'pack_1200', coins: 1000, bonusCoins: 200, priceUsd: 9.99 },
  { id: 'pack_3000', coins: 2500, bonusCoins: 500, priceUsd: 24.99, bestValue: true },
  { id: 'pack_7000', coins: 6000, bonusCoins: 1000, priceUsd: 49.99 },
  { id: 'pack_15000', coins: 13000, bonusCoins: 2000, priceUsd: 99.99 },
];
