import { CoinTransaction, UserAchievement, UserLiveStats } from '@/src/types/live';

const INITIAL_ACHIEVEMENTS: UserAchievement[] = [
  {
    id: 'voice_pioneer',
    title: 'Voice Pioneer',
    description: 'Speak on 10 live voice room seats',
    icon: '🎙️',
    progress: 1,
    maxProgress: 10,
  },
  {
    id: 'quiz_master',
    title: 'Quiz Master',
    description: 'Win 5 interactive room quizzes',
    icon: '🧠',
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'chatterbox',
    title: 'Chatterbox',
    description: 'Send 50 messages in live voice rooms',
    icon: '💬',
    progress: 5,
    maxProgress: 50,
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Hang out in late-night live rooms',
    icon: '🦉',
    progress: 1,
    maxProgress: 3,
  },
  {
    id: 'generous_star',
    title: 'Generous Star',
    description: 'Send virtual gifts to voice seat hosts',
    icon: '🌟',
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'music_maestro',
    title: 'Music Maestro',
    description: 'Share and sync local music in a live room',
    icon: '🎵',
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'room_creator',
    title: 'Room Host',
    description: 'Create and host your own live voice room',
    icon: '👑',
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'honorary_admin',
    title: 'Honorary Admin',
    description: 'Serve as an appointed Admin in a voice room',
    icon: '🛡️',
    progress: 0,
    maxProgress: 1,
  },
];

export function generateLiveSpecialId(userId: string): string {
  // Generate consistent 5-digit number from user id
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const num = Math.abs(hash % 90000) + 10000;
  return `LV-${num}`;
}

export function getXpForNextLevel(level: number): number {
  return level * 150 + 100;
}

export class LiveStorageService {
  private static getKey(prefix: string, userId: string): string {
    return `live_${prefix}_${userId}`;
  }

  public static getStats(userId: string): UserLiveStats {
    const key = this.getKey('stats', userId);
    if (typeof window === 'undefined') {
      return this.defaultStats(userId);
    }
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.specialId) parsed.specialId = generateLiveSpecialId(userId);
        if (!parsed.achievements || parsed.achievements.length === 0) {
          parsed.achievements = INITIAL_ACHIEVEMENTS;
        }
        return parsed;
      }
    } catch (e) {}

    const fresh = this.defaultStats(userId);
    this.saveStats(userId, fresh);
    return fresh;
  }

  public static defaultStats(userId: string): UserLiveStats {
    return {
      userId,
      level: 3,
      xp: 280,
      nextLevelXp: 550,
      specialId: generateLiveSpecialId(userId),
      coinsBalance: 1200, // Initial welcoming balance for testing gifts & entertainment
      giftsSentCount: 0,
      giftsReceivedCount: 0,
      coinsSentTotal: 0,
      coinsReceivedTotal: 0,
      roomsHostedCount: 0,
      timeSpentMinutes: 15,
      quizzesWonCount: 0,
      badges: ['Voice Pioneer', 'Early Explorer', 'Chat Enthusiast'],
      achievements: INITIAL_ACHIEVEMENTS,
    };
  }

  public static saveStats(userId: string, stats: UserLiveStats) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getKey('stats', userId), JSON.stringify(stats));
    } catch (e) {}
  }

  public static addXp(userId: string, amount: number, onLevelUp?: (newLevel: number) => void): UserLiveStats {
    const stats = this.getStats(userId);
    let xp = stats.xp + amount;
    let level = stats.level;
    let nextXp = stats.nextLevelXp;

    while (xp >= nextXp) {
      xp -= nextXp;
      level += 1;
      nextXp = getXpForNextLevel(level);
      onLevelUp?.(level);
    }

    stats.xp = xp;
    stats.level = level;
    stats.nextLevelXp = nextXp;
    this.saveStats(userId, stats);
    return stats;
  }

  public static getTransactions(userId: string): CoinTransaction[] {
    const key = this.getKey('transactions', userId);
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    // default initial transaction
    return [
      {
        id: 'tx_welcome',
        userId,
        type: 'reward',
        amount: 1200,
        balanceAfter: 1200,
        description: 'Welcome Bonus Coins',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  }

  public static recordTransaction(userId: string, tx: Omit<CoinTransaction, 'id' | 'createdAt'>): CoinTransaction {
    const txList = this.getTransactions(userId);
    const newTx: CoinTransaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newTx, ...txList.slice(0, 99)];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.getKey('transactions', userId), JSON.stringify(updated));
      } catch (e) {}
    }
    return newTx;
  }

  public static deductCoins(userId: string, amount: number, description: string): { success: boolean; newBalance: number } {
    const stats = this.getStats(userId);
    if (stats.coinsBalance < amount) {
      return { success: false, newBalance: stats.coinsBalance };
    }
    stats.coinsBalance -= amount;
    stats.coinsSentTotal += amount;
    stats.giftsSentCount += 1;
    this.saveStats(userId, stats);

    this.recordTransaction(userId, {
      userId,
      type: 'gift_sent',
      amount: -amount,
      balanceAfter: stats.coinsBalance,
      description,
    });

    // Award XP for generosity
    this.addXp(userId, Math.floor(amount / 5) + 15);

    return { success: true, newBalance: stats.coinsBalance };
  }

  public static creditCoins(userId: string, amount: number, description: string, type: 'purchase' | 'gift_received' | 'reward' = 'purchase'): number {
    const stats = this.getStats(userId);
    stats.coinsBalance += amount;
    if (type === 'gift_received') {
      stats.coinsReceivedTotal += amount;
      stats.giftsReceivedCount += 1;
    }
    this.saveStats(userId, stats);

    this.recordTransaction(userId, {
      userId,
      type,
      amount,
      balanceAfter: stats.coinsBalance,
      description,
    });

    // Award XP
    this.addXp(userId, Math.floor(amount / 10) + 10);

    return stats.coinsBalance;
  }

  public static getFavoriteRooms(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('live_favorite_rooms');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  public static toggleFavoriteRoom(roomId: string): boolean {
    const favs = this.getFavoriteRooms();
    let isFav = false;
    let updated: string[];
    if (favs.includes(roomId)) {
      updated = favs.filter((id) => id !== roomId);
      isFav = false;
    } else {
      updated = [...favs, roomId];
      isFav = true;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('live_favorite_rooms', JSON.stringify(updated));
      } catch {}
    }
    return isFav;
  }
}
