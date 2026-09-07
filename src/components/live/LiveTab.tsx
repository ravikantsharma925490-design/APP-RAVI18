import React, { useState, useEffect } from 'react';
import {
  Search,
  Radio,
  Sparkles,
  TrendingUp,
  Flame,
  Star,
  Clock,
  Plus,
  Users,
  Music,
  Lock,
  Gamepad2,
  Filter,
  Bookmark,
  ChevronRight,
  Crown,
  Shield,
  Coins,
} from 'lucide-react';
import { LiveRoom, LiveRoomCategory } from '@/src/types/live';
import { Profile } from '@/src/types';
import { useLiveRoomsList, LiveRoomsFilter } from '@/src/hooks/useLiveRoomsList';
import { LiveStorageService, generateLiveSpecialId } from '@/src/lib/live/live-storage';
import { CreateLiveRoomModal } from './CreateLiveRoomModal';
import { LiveCoinStoreModal } from './LiveCoinStoreModal';
import { useLiveCoins } from '@/src/hooks/useLiveCoins';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface LiveTabProps {
  currentUser: Profile;
  onJoinRoom: (room: LiveRoom) => void;
}

const CATEGORIES: { id: LiveRoomCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All Rooms', icon: '🔥' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'hangout', label: 'Hangout', icon: '☕' },
  { id: 'poetry', label: 'Poetry', icon: '✍️' },
  { id: 'friendship', label: 'Friends', icon: '🌍' },
  { id: 'debate', label: 'Debate', icon: '💡' },
  { id: 'learning', label: 'Learning', icon: '📚' },
  { id: 'night', label: 'Late Night', icon: '🌌' },
];

export const LiveTab: React.FC<LiveTabProps> = ({ currentUser, onJoinRoom }) => {
  const {
    rooms,
    filter,
    setFilter,
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    loading,
    refreshRooms,
    isCreatingRoom,
    setIsCreatingRoom,
    createRoom,
    favoriteRoomIds,
    toggleFavorite,
  } = useLiveRoomsList(currentUser);

  const {
    balance: userCoins,
    transactions,
    packages,
    isStoreOpen,
    setIsStoreOpen,
    buyCoins,
  } = useLiveCoins(currentUser);

  const userStats = LiveStorageService.getStats(currentUser.id);
  const [directRoomId, setDirectRoomId] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Real community members from Supabase profiles
  const [communityProfiles, setCommunityProfiles] = useState<Profile[]>([]);
  const [communityLoading, setCommunityLoading] = useState<boolean>(false);

  useEffect(() => {
    setCommunityLoading(true);
    fetch('/api/live/community')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.profiles)) {
          setCommunityProfiles(data.profiles.filter((p: Profile) => p.id !== currentUser.id));
        }
      })
      .catch(() => {})
      .finally(() => setCommunityLoading(false));
  }, [currentUser.id]);

  const handleDirectJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!directRoomId.trim()) return;

    const matched = rooms.find(
      (r) => r.roomId === directRoomId.trim() || r.id === directRoomId.trim()
    );
    if (matched) {
      onJoinRoom(matched);
    } else {
      setJoinError(`No live room found with ID "${directRoomId.trim()}"`);
    }
  };

  const handleCreateRoomSubmit = async (params: any) => {
    const newRoom = await createRoom(params);
    if (newRoom) {
      onJoinRoom(newRoom);
    }
  };

  const handleQuickStartRoom = async (invitedUser?: Profile) => {
    const roomName = invitedUser
      ? `🎙️ ${currentUser.display_name} & ${invitedUser.display_name}'s Voice Room`
      : `🎙️ ${currentUser.display_name}'s Live Room`;
    const newRoom = await createRoom({
      name: roomName,
      description: invitedUser
        ? `Open voice room with ${invitedUser.display_name}. Feel free to take a seat!`
        : `Live voice chat hosted by ${currentUser.display_name}. Open 8-seat room!`,
      category: 'chat',
      tags: ['live', 'voice', 'chat'],
    });
    if (newRoom) {
      onJoinRoom(newRoom);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-neutral-950 text-white select-none pb-24">
      {/* Top Discovery Header */}
      <div className="px-4 pt-5 pb-3 border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-2xl bg-red-500/20 text-red-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-1.5">
                <span>Live Voice</span>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                  LIVE
                </span>
              </h1>
              <p className="text-xs text-neutral-400">8 voice seats, local music & games</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Coins Balance Pill */}
            <button
              type="button"
              onClick={() => setIsStoreOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-300">{userCoins.toLocaleString()}</span>
              <span className="text-[10px] font-extrabold text-amber-400 ml-0.5 bg-amber-500/30 px-1 rounded-full">+</span>
            </button>

            {/* Go Live Button */}
            <button
              type="button"
              onClick={() => setIsCreatingRoom(true)}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Go Live</span>
            </button>
          </div>
        </div>

        {/* User Progression Bar */}
        <div className="mt-3.5 p-2.5 rounded-2xl bg-neutral-950/80 border border-neutral-800/90 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center space-x-1 border border-amber-500/30">
              <Sparkles className="w-3 h-3" />
              <span>Lv. {userStats.level}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-neutral-200">
                Voice Rank: {userStats.badges[0] || 'Explorer'}
              </span>
              <div className="w-28 sm:w-36 h-1.5 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                  style={{ width: `${Math.min(100, (userStats.xp / userStats.nextLevelXp) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-neutral-400 block">Live Special ID</span>
            <span className="text-xs font-mono font-bold text-amber-300">
              {userStats.specialId || generateLiveSpecialId(currentUser.id)}
            </span>
          </div>
        </div>

        {/* Search & Direct Join by Room ID */}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by Room Title, Category, or Host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Quick ID Jump */}
          <form onSubmit={handleDirectJoin} className="flex space-x-1.5">
            <input
              type="text"
              placeholder="Room ID #"
              value={directRoomId}
              onChange={(e) => setDirectRoomId(e.target.value)}
              className="w-28 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Join ID
            </button>
          </form>
        </div>

        {joinError && (
          <p className="text-xs text-red-400 font-semibold mt-1.5">{joinError}</p>
        )}
      </div>

      {/* Discovery Filter Navigation (Trending, Popular, Recommended, New) */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-800/60 bg-neutral-950">
        <div className="flex space-x-1.5 overflow-x-auto">
          {[
            { id: 'trending' as const, label: 'Trending', icon: TrendingUp },
            { id: 'popular' as const, label: 'Popular', icon: Flame },
            { id: 'recommended' as const, label: 'Recommended', icon: Star },
            { id: 'new' as const, label: 'New', icon: Clock },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                filter === id
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <span className="text-[11px] text-neutral-400 font-semibold whitespace-nowrap pl-2">
          {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
        </span>
      </div>

      {/* Category Pills Bar */}
      <div className="px-4 py-2.5 flex space-x-2 overflow-x-auto border-b border-neutral-800/40">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={cn(
              'flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              category === cat.id
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            )}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ROOMS LIST / GRID */}
      {rooms.length > 0 && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {rooms.map((room, rankIndex) => {
            const occupiedSeatsCount = room.seats.filter((s) => s.user !== null).length;
            const isFav = favoriteRoomIds.includes(room.id);

            return (
              <div
                key={room.id}
                onClick={() => onJoinRoom(room)}
                className="p-3.5 rounded-3xl bg-neutral-900/80 border border-neutral-800/90 hover:border-neutral-700 hover:bg-neutral-900 transition-all shadow-md group cursor-pointer flex flex-col justify-between"
              >
                {/* Top Room Banner */}
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-neutral-800 border border-neutral-700/80 flex-shrink-0">
                        {room.photoUrl ? (
                          <img src={room.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-base">
                            🎙️
                          </div>
                        )}

                        {/* Rank badge */}
                        {rankIndex < 3 && (
                          <span className="absolute top-0 left-0 px-1.5 py-0.2 rounded-br-lg bg-amber-500 text-neutral-950 text-[9px] font-black">
                            #{rankIndex + 1}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h3 className="text-sm font-extrabold text-white truncate group-hover:text-blue-400 transition-colors">
                            {room.name}
                          </h3>
                          {room.isPrivate && <Lock className="w-3 h-3 text-amber-400" />}
                        </div>

                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          Host: {room.owner.display_name}
                        </p>
                      </div>
                    </div>

                    {/* Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(room.id);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-amber-400 transition-colors"
                    >
                      <Bookmark className={cn('w-4 h-4', isFav ? 'fill-amber-400 text-amber-400' : '')} />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-neutral-400 mt-2.5 line-clamp-2 leading-relaxed">
                    {room.description}
                  </p>
                </div>

                {/* Badges & Live Status Footer */}
                <div className="mt-3.5 pt-3 border-t border-neutral-800/70 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    {/* Seat count */}
                    <span className="px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-300 text-[10px] font-bold border border-neutral-700/60">
                      🎙️ {occupiedSeatsCount}/8 Seats
                    </span>

                    {/* Online count */}
                    <span className="flex items-center space-x-1 text-emerald-400 font-bold text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{room.onlineCount} online</span>
                    </span>

                    {/* Music indicator if active */}
                    {room.currentMusic?.isPlaying && (
                      <span className="text-purple-400 font-bold text-[10px] flex items-center space-x-0.5">
                        <Music className="w-3 h-3 animate-bounce" />
                        <span>Music</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 font-mono text-[10px] text-neutral-400 font-semibold">
                    <span>ID: {room.roomId}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Community Members Section (Real Users from Supabase Database) */}
      <div className="px-4 mt-3 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-neutral-400" />
            <h2 className="text-sm font-bold text-neutral-200">Community Members</h2>
            <span className="px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px] font-semibold">
              {communityProfiles.length} real members
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleQuickStartRoom()}
            className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center space-x-1 cursor-pointer"
          >
            <span>Start Voice Room</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {communityProfiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {communityProfiles.slice(0, 6).map((profile) => (
              <div
                key={profile.id}
                className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-neutral-700">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className={cn(
                            'w-full h-full flex items-center justify-center font-bold text-xs text-white',
                            getAvatarColor(profile.id)
                          )}
                        >
                          {getInitials(profile.display_name)}
                        </div>
                      )}
                    </div>
                    {profile.is_online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-neutral-900" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-200 truncate">
                      {profile.display_name}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate">
                      @{profile.username}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickStartRoom(profile)}
                  className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-red-600/80 text-white text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center space-x-1"
                >
                  <Radio className="w-3 h-3 text-red-400" />
                  <span>Start Room</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          !communityLoading && (
            <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/50 text-center">
              <p className="text-xs text-neutral-400">Loading registered community members from database...</p>
            </div>
          )
        )}
      </div>

      {rooms.length === 0 && !loading && (
        <div className="mx-4 p-8 rounded-3xl bg-gradient-to-b from-neutral-900/80 to-neutral-950 border border-neutral-800 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">No Live Rooms Active</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 leading-relaxed">
              Real voice data only. You can be the first to host an 8-seat Live Voice Room with WebRTC microphone streaming, local music, and live chat!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingRoom(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Go Live (Custom Room)</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickStartRoom()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-red-400" />
              <span>1-Tap Instant Room</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      <CreateLiveRoomModal
        isOpen={isCreatingRoom}
        onClose={() => setIsCreatingRoom(false)}
        onCreateRoom={handleCreateRoomSubmit}
      />

      {/* Coin Store Modal */}
      <LiveCoinStoreModal
        isOpen={isStoreOpen}
        onClose={() => setIsStoreOpen(false)}
        currentUser={currentUser}
        userCoins={userCoins}
        packages={packages}
        transactions={transactions}
        onBuyCoins={buyCoins}
      />
    </div>
  );
};
