import React, { useState, useRef, useEffect } from 'react';
import {
  Minimize2,
  X,
  Share2,
  Users,
  Mic,
  MicOff,
  Radio,
  Coins,
  Gift,
  Music,
  Gamepad2,
  Shield,
  Send,
  Smile,
  Crown,
  Lock,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { LiveRoom } from '@/src/types/live';
import { Profile } from '@/src/types';
import { useLiveRoom } from '@/src/hooks/useLiveRoom';
import { useLiveCoins } from '@/src/hooks/useLiveCoins';
import { LiveVoiceSeatCard } from './LiveVoiceSeatCard';
import { LiveGiftModal } from './LiveGiftModal';
import { LiveGiftAnimationOverlay } from './LiveGiftAnimationOverlay';
import { LiveCoinStoreModal } from './LiveCoinStoreModal';
import { LiveRoomProfileModal } from './LiveRoomProfileModal';
import { LiveLocalMusicPlayer } from './LiveLocalMusicPlayer';
import { LiveEntertainmentModal } from './LiveEntertainmentModal';
import { LiveModerationModal } from './LiveModerationModal';
import { LiveRoomShareModal } from './LiveRoomShareModal';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface LiveRoomScreenProps {
  room: LiveRoom;
  currentUser: Profile;
  onMinimize: () => void;
  onLeaveRoom: () => void;
}

const REACTION_EMOJIS = ['💖', '🔥', '⭐', '👏', '🎉', '👑'];

export const LiveRoomScreen: React.FC<LiveRoomScreenProps> = ({
  room: initialRoom,
  currentUser,
  onMinimize,
  onLeaveRoom,
}) => {
  const {
    room,
    mySeatIndex,
    isMicMuted,
    toggleMicrophone,
    isSpeakingLocally,
    chatMessages,
    sendMessage,
    floatingReactions,
    sendReaction,
    activeGiftEvent,
    highlightedSeatIndex,
    sendGift,
    takeSeat,
    leaveSeat,
    leaveRoom,
    // Modals
    isGiftModalOpen,
    setIsGiftModalOpen,
    giftTargetSeatIndex,
    setGiftTargetSeatIndex,
    isMusicModalOpen,
    setIsMusicModalOpen,
    isEntertainmentModalOpen,
    setIsEntertainmentModalOpen,
    isModerationModalOpen,
    setIsModerationModalOpen,
    isShareModalOpen,
    setIsShareModalOpen,
    selectedUserForCard,
    setSelectedUserForCard,
    // Music
    canPlayMusic,
    localMusicPlaylist,
    currentTrackIndex,
    musicVolume,
    setAudioVolume,
    handleSelectLocalMusicFiles,
    togglePlayPauseMusic,
    nextTrack,
    prevTrack,
    // Moderation
    isOwner,
    isAdmin,
    performRoomAction,
  } = useLiveRoom(initialRoom, currentUser);

  const {
    balance: userCoins,
    transactions,
    packages,
    isStoreOpen,
    setIsStoreOpen,
    buyCoins,
    refreshCoins,
  } = useLiveCoins(currentUser);

  const [chatInputText, setChatInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (!room) return null;

  const isSeated = mySeatIndex !== null;

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    sendMessage(chatInputText);
    setChatInputText('');
    setShowEmojiPicker(false);
  };

  const handleOpenGiftForUser = (targetUser: Profile) => {
    const seatIdx = room.seats.findIndex((s) => s.user?.id === targetUser.id);
    setGiftTargetSeatIndex(seatIdx !== -1 ? seatIdx : null);
    setIsGiftModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-40 bg-neutral-950 text-white flex flex-col overflow-hidden select-none animate-fade-in">
      {/* Background Ambience Layer */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-600/20 rounded-full blur-3xl" />
      </div>

      {/* TOP BAR */}
      <header className="relative z-10 px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          {/* Room Thumbnail / Host Avatar */}
          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-neutral-800 border border-neutral-700 flex-shrink-0 shadow">
            {room.photoUrl ? (
              <img src={room.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-sm">
                🎙️
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-extrabold text-white truncate max-w-[160px] sm:max-w-xs">
                {room.name}
              </h1>
              {room.isPrivate && (
                <span className="p-0.5 rounded bg-amber-500/20 text-amber-400">
                  <Lock className="w-3 h-3" />
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-neutral-400 mt-0.5">
              <span className="font-mono bg-neutral-800/80 px-1.5 py-0.2 rounded text-neutral-300 font-bold">
                ID: {room.roomId}
              </span>
              <span>·</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{room.onlineCount} online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Coin balance button */}
          <button
            type="button"
            onClick={() => setIsStoreOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
            title="Buy Coins"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-bold text-amber-300">{userCoins.toLocaleString()}</span>
            <span className="text-[10px] font-extrabold text-amber-400 ml-0.5">+</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Share Room"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Minimize */}
          <button
            type="button"
            onClick={onMinimize}
            className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Minimize Room"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={() => {
              leaveRoom();
              onLeaveRoom();
            }}
            className="p-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-800/50 transition-colors cursor-pointer"
            title="Leave Room"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CENTER SECTION: 8 Voice Seats Grid + Audience + Interactive Strip */}
      <div className="relative z-10 flex-1 overflow-y-auto flex flex-col justify-between p-3 sm:p-5">
        {/* Active interactive banner if game or music playing */}
        <div className="space-y-2 mb-3">
          {/* Synchronized Local Music Strip */}
          {room.currentMusic?.isPlaying && (
            <div
              onClick={() => setIsMusicModalOpen(true)}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-purple-900/40 via-pink-900/40 to-neutral-900 border border-purple-500/30 flex items-center justify-between cursor-pointer hover:border-purple-500/60 transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400 animate-pulse">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate max-w-xs">
                    🎵 {room.currentMusic.songTitle}
                  </p>
                  <p className="text-[10px] text-purple-300">
                    Broadcasting by {room.currentMusic.playedBy.name} · Tap to view controls
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-500 text-white shadow">
                SYNC
              </span>
            </div>
          )}

          {/* Interactive Game / Poll Strip */}
          {room.currentActivity?.isActive && (
            <div
              onClick={() => setIsEntertainmentModalOpen(true)}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 flex items-center justify-between cursor-pointer hover:border-blue-500/60 transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 animate-bounce">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    🎮 {room.currentActivity.title}
                  </p>
                  <p className="text-[10px] text-blue-300 truncate">
                    {room.currentActivity.data.question}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-sm">
                Play
              </span>
            </div>
          )}
        </div>

        {/* 8 CIRCULAR VOICE SEATS (Grid: 4 top, 4 bottom) */}
        <div className="my-auto py-2">
          <div className="grid grid-cols-4 gap-y-4 gap-x-2 sm:gap-x-4 max-w-md mx-auto">
            {room.seats.map((seat, index) => {
              const seatNum = index + 1;
              const isSeatOwner = seat.user?.id === room.ownerId;
              const isSeatAdmin = seat.user?.id === room.adminId;
              const isMe = Boolean(currentUser && seat.user?.id === currentUser.id);
              const isHighlighted = highlightedSeatIndex === index;

              return (
                <LiveVoiceSeatCard
                  key={seat.seatIndex}
                  seat={seat}
                  seatNumber={seatNum}
                  isOwner={isSeatOwner}
                  isAdmin={isSeatAdmin}
                  isCurrentUser={isMe}
                  isHighlighted={isHighlighted}
                  onSelectUser={(u) => setSelectedUserForCard(u)}
                  onTakeSeat={(seatIdx) => takeSeat(seatIdx)}
                />
              );
            })}
          </div>

          {/* AUDIENCE ROW */}
          <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between max-w-md mx-auto px-2">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-bold text-neutral-300">
                Audience ({room.audience.length})
              </span>
            </div>

            <div className="flex -space-x-1.5 overflow-hidden">
              {room.audience.slice(0, 6).map((aud) => (
                <button
                  key={aud.id}
                  type="button"
                  onClick={() => setSelectedUserForCard(aud)}
                  className="w-7 h-7 rounded-full border-2 border-neutral-900 overflow-hidden bg-neutral-800 hover:scale-110 transition-transform cursor-pointer"
                  title={aud.display_name}
                >
                  {aud.avatar_url ? (
                    <img src={aud.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-white flex items-center justify-center w-full h-full">
                      {aud.display_name.charAt(0)}
                    </span>
                  )}
                </button>
              ))}
              {room.audience.length > 6 && (
                <span className="w-7 h-7 rounded-full border-2 border-neutral-900 bg-neutral-800 text-[9px] font-bold text-neutral-400 flex items-center justify-center">
                  +{room.audience.length - 6}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* REAL-TIME CHAT STREAM */}
        <div className="relative max-w-md mx-auto w-full h-36 sm:h-44 flex flex-col justify-end mt-2">
          <div
            ref={chatScrollRef}
            className="overflow-y-auto space-y-1.5 pr-1.5 max-h-full scrollbar-thin scrollbar-thumb-neutral-800"
          >
            {chatMessages.slice(-40).map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'px-3 py-1.5 rounded-2xl text-xs backdrop-blur-md max-w-[90%]',
                  msg.type === 'system'
                    ? 'bg-neutral-900/60 text-neutral-400 italic text-[11px] border border-neutral-800/40'
                    : msg.type === 'gift'
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                    : msg.type === 'game'
                    ? 'bg-purple-500/15 border border-purple-500/30 text-purple-200'
                    : 'bg-neutral-900/85 border border-neutral-800/80 text-neutral-200'
                )}
              >
                {msg.type !== 'system' && (
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedUserForCard(msg.sender)}
                      className="font-bold text-white hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>{msg.sender.display_name}</span>
                    </button>

                    {/* Chat sender badge */}
                    {msg.badge === 'owner' && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-extrabold flex items-center space-x-0.5">
                        <Crown className="w-2.5 h-2.5 fill-current" />
                        <span>Owner</span>
                      </span>
                    )}
                    {msg.badge === 'admin' && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[9px] font-extrabold flex items-center space-x-0.5">
                        <Shield className="w-2.5 h-2.5 fill-current" />
                        <span>Admin</span>
                      </span>
                    )}
                    {msg.badge === 'seat' && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-extrabold">
                        Seat
                      </span>
                    )}
                  </div>
                )}
                <p className="leading-snug break-words">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Floating reactions stream */}
          <div className="absolute right-2 bottom-2 pointer-events-none flex flex-col items-center space-y-1">
            {floatingReactions.slice(-8).map((rx) => (
              <div
                key={rx.id}
                className="text-2xl animate-float-up opacity-90 filter drop-shadow-md"
                style={{ transform: `translateX(${(rx.x % 40) - 20}px)` }}
              >
                {rx.emoji}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS & CHAT BAR */}
      <footer className="relative z-10 px-3 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-neutral-800/90 bg-neutral-900/95 backdrop-blur-md flex flex-col space-y-2.5">
        {/* Quick Reactions Bar */}
        <div className="flex items-center justify-between max-w-md mx-auto w-full">
          <div className="flex items-center space-x-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => sendReaction(emoji)}
                className="p-1.5 sm:p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-lg hover:scale-125 transition-transform active:scale-95 cursor-pointer shadow-sm"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Seat Action Button: Take Seat or Move to Audience */}
          {isSeated ? (
            <button
              type="button"
              onClick={leaveSeat}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Vacate Seat
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                // Find first open seat
                const openIdx = room.seats.findIndex((s) => !s.user && !s.isLocked);
                if (openIdx !== -1) takeSeat(openIdx);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              Take a Seat 🎙️
            </button>
          )}
        </div>

        {/* Action Controls & Chat Input */}
        <div className="flex items-center space-x-2 max-w-md mx-auto w-full">
          {/* Chat Form */}
          <form onSubmit={handleSendChat} className="flex-1 flex items-center space-x-1 bg-neutral-950 rounded-2xl border border-neutral-800 px-3 py-1.5">
            <input
              type="text"
              placeholder="Send a message to room..."
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!chatInputText.trim()}
              className="p-1 text-neutral-400 hover:text-blue-400 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Mic Mute/Unmute (if seated) */}
          {isSeated && (
            <button
              type="button"
              onClick={toggleMicrophone}
              className={cn(
                'p-2.5 rounded-2xl transition-all shadow-md cursor-pointer',
                isMicMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-emerald-500 text-white hover:bg-emerald-400'
              )}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Gift Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsGiftModalOpen(true)}
            className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold hover:brightness-110 transition-all shadow-md cursor-pointer"
            title="Send Virtual Gift"
          >
            <Gift className="w-4 h-4" />
          </button>

          {/* Local Device Music */}
          <button
            type="button"
            onClick={() => setIsMusicModalOpen(true)}
            className={cn(
              'p-2.5 rounded-2xl transition-all cursor-pointer',
              room.currentMusic?.isPlaying
                ? 'bg-purple-600 text-white shadow-purple-500/30 shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:text-white'
            )}
            title="Local Music"
          >
            <Music className="w-4 h-4" />
          </button>

          {/* Interactive Entertainment / Games */}
          <button
            type="button"
            onClick={() => setIsEntertainmentModalOpen(true)}
            className={cn(
              'p-2.5 rounded-2xl transition-all cursor-pointer',
              room.currentActivity?.isActive
                ? 'bg-blue-600 text-white shadow-blue-500/30 shadow-md'
                : 'bg-neutral-800 text-neutral-300 hover:text-white'
            )}
            title="Entertainment & Quizzes"
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          {/* Room Moderation (Owner or Admin) */}
          {(isOwner || isAdmin) && (
            <button
              type="button"
              onClick={() => setIsModerationModalOpen(true)}
              className="p-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-blue-400 transition-colors cursor-pointer"
              title="Moderation & Permissions"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* OVERLAY: Virtual Gift Full Animation Canvas */}
      <LiveGiftAnimationOverlay giftEvent={activeGiftEvent} />

      {/* MODALS */}
      {/* 1. Gift Modal */}
      <LiveGiftModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        room={room}
        currentUser={currentUser}
        userCoins={userCoins}
        initialTargetSeatIndex={giftTargetSeatIndex}
        onSendGift={sendGift}
        onOpenCoinStore={() => {
          setIsGiftModalOpen(false);
          setIsStoreOpen(true);
        }}
      />

      {/* 2. Coin Store Modal */}
      <LiveCoinStoreModal
        isOpen={isStoreOpen}
        onClose={() => setIsStoreOpen(false)}
        currentUser={currentUser}
        userCoins={userCoins}
        packages={packages}
        transactions={transactions}
        onBuyCoins={buyCoins}
      />

      {/* 3. Live Room Profile Card Modal (with Live Room Special ID Label) */}
      <LiveRoomProfileModal
        isOpen={selectedUserForCard !== null}
        onClose={() => setSelectedUserForCard(null)}
        user={selectedUserForCard}
        currentUser={currentUser}
        room={room}
        onOpenGiftForUser={handleOpenGiftForUser}
        onModerationAction={performRoomAction}
      />

      {/* 4. Local Device Music Modal */}
      <LiveLocalMusicPlayer
        isOpen={isMusicModalOpen}
        onClose={() => setIsMusicModalOpen(false)}
        room={room}
        currentUser={currentUser}
        canPlayMusic={canPlayMusic}
        localMusicPlaylist={localMusicPlaylist}
        currentTrackIndex={currentTrackIndex}
        musicVolume={musicVolume}
        onSelectFiles={handleSelectLocalMusicFiles}
        onTogglePlayPause={togglePlayPauseMusic}
        onNextTrack={nextTrack}
        onPrevTrack={prevTrack}
        onVolumeChange={setAudioVolume}
      />

      {/* 5. Entertainment & Games Modal */}
      <LiveEntertainmentModal
        isOpen={isEntertainmentModalOpen}
        onClose={() => setIsEntertainmentModalOpen(false)}
        room={room}
        currentUser={currentUser}
        canManageGames={isOwner || (isAdmin && Boolean(room.adminPermissions.canManageGames))}
        onUpdateRoom={() => {}}
      />

      {/* 6. Moderation Modal */}
      <LiveModerationModal
        isOpen={isModerationModalOpen}
        onClose={() => setIsModerationModalOpen(false)}
        room={room}
        currentUser={currentUser}
        onAction={performRoomAction}
        onCloseRoom={() => {
          setIsModerationModalOpen(false);
          leaveRoom();
          onLeaveRoom();
        }}
      />

      {/* 7. Share Modal */}
      <LiveRoomShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        room={room}
      />
    </div>
  );
};
