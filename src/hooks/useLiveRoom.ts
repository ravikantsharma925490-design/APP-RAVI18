import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LiveRoom,
  LiveVoiceSeat,
  LiveChatMessage,
  LiveGift,
  LiveGiftEvent,
  LiveRoomMusicState,
  LiveRoomActivity,
  LIVE_GIFT_CATALOG,
} from '../types/live';
import { Profile } from '../types';
import { liveAudioService } from '../lib/live/live-audio-service';
import { LiveStorageService } from '../lib/live/live-storage';
import { LiveRoomAudioMesh } from '../lib/live/live-room-mesh';

export interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  senderName: string;
}

export function useLiveRoom(initialRoom: LiveRoom | null, currentUser: Profile | null) {
  const [room, setRoom] = useState<LiveRoom | null>(initialRoom);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isSpeakingLocally, setIsSpeakingLocally] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [activeGiftEvent, setActiveGiftEvent] = useState<LiveGiftEvent | null>(null);
  const [highlightedSeatIndex, setHighlightedSeatIndex] = useState<number | null>(null);

  // Profile Card Modal state (Inside Live Room: displays Special ID Label)
  const [selectedUserForCard, setSelectedUserForCard] = useState<Profile | null>(null);

  // Modals state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState<boolean>(false);
  const [giftTargetSeatIndex, setGiftTargetSeatIndex] = useState<number | null>(null);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState<boolean>(false);
  const [isEntertainmentModalOpen, setIsEntertainmentModalOpen] = useState<boolean>(false);
  const [isModerationModalOpen, setIsModerationModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Local music file audio element reference
  const localMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [localMusicPlaylist, setLocalMusicPlaylist] = useState<File[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [musicVolume, setMusicVolume] = useState<number>(0.7);

  // WebRTC Multi-Peer Real Audio Mesh Ref
  const meshRef = useRef<LiveRoomAudioMesh | null>(null);

  // Determine current user's role in the room
  const isOwner = Boolean(currentUser && room && room.ownerId === currentUser.id);
  const isAdmin = Boolean(currentUser && room && room.adminId === currentUser.id);
  const canPlayMusic = isOwner || (isAdmin && Boolean(room?.adminPermissions.canPlayMusic));

  // Initialize WebRTC Real Voice Mesh for this Live Room
  useEffect(() => {
    if (!room?.id || !currentUser?.id) return;

    const mesh = new LiveRoomAudioMesh(room.id, currentUser.id);
    meshRef.current = mesh;

    return () => {
      mesh.destroy();
      meshRef.current = null;
    };
  }, [room?.id, currentUser?.id]);

  // Determine my seat
  useEffect(() => {
    if (!room || !currentUser) {
      setMySeatIndex(null);
      return;
    }
    const idx = room.seats.findIndex((s) => s.user?.id === currentUser.id);
    setMySeatIndex(idx !== -1 ? idx : null);
  }, [room, currentUser]);

  // Synchronize remote speakers with audio mesh
  useEffect(() => {
    if (!meshRef.current || !room) return;
    const seatedUserIds = room.seats
      .filter((s) => s.user !== null)
      .map((s) => s.user!.id);
    meshRef.current.syncSpeakers(seatedUserIds);
  }, [room?.seats]);

  // Handle local microphone and stream into WebRTC mesh when seated
  useEffect(() => {
    if (mySeatIndex !== null && currentUser) {
      liveAudioService
        .startMicrophone((isSpeaking) => {
          setIsSpeakingLocally(isSpeaking);
          if (room) {
            // Broadcast speaking state
            fetch('/api/live/rooms/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: room.id,
                action: 'set_speaking',
                userId: currentUser.id,
                payload: { isSpeaking },
              }),
            }).catch(() => {});
          }
        })
        .then((stream) => {
          if (meshRef.current && stream) {
            meshRef.current.setLocalMicrophone(stream, true);
          }
        });
    } else {
      liveAudioService.stopMicrophone();
      setIsSpeakingLocally(false);
      if (meshRef.current) {
        meshRef.current.setLocalMicrophone(null, false);
      }
    }

    return () => {
      liveAudioService.stopMicrophone();
    };
  }, [mySeatIndex, currentUser, room?.id]);

  // Sync mic mute state
  const toggleMicrophone = () => {
    const nextState = !isMicMuted;
    setIsMicMuted(nextState);
    liveAudioService.setMicrophoneMuted(nextState);
    if (meshRef.current) {
      // Re-apply mute state
      meshRef.current.setLocalMicrophone(
        nextState ? null : (liveAudioService as any).localStream,
        mySeatIndex !== null
      );
    }
  };

  // Poll room updates & chat messages
  const fetchRoomState = useCallback(async () => {
    if (!room) return;
    try {
      const res = await fetch('/api/live/rooms/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: room.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setRoom(data.room);
          if (Array.isArray(data.recentChats)) {
            setChatMessages(data.recentChats);
          }
          // If recent gift event arrived
          if (Array.isArray(data.recentGifts) && data.recentGifts.length > 0) {
            const latestGift = data.recentGifts[data.recentGifts.length - 1];
            if (!activeGiftEvent || activeGiftEvent.id !== latestGift.id) {
              triggerGiftEffects(latestGift);
            }
          }
        }
      }
    } catch (e) {
      // quiet
    }
  }, [room?.id, activeGiftEvent?.id]);

  useEffect(() => {
    if (!room) return;
    fetchRoomState();
    const interval = setInterval(fetchRoomState, 2500);
    return () => clearInterval(interval);
  }, [fetchRoomState, room?.id]);

  // Trigger full gift sequence: Animation -> Sound Effect -> Light Haptic -> Highlight Profile
  const triggerGiftEffects = (giftEvt: LiveGiftEvent) => {
    setActiveGiftEvent(giftEvt);
    liveAudioService.playGiftSound(giftEvt.gift.animationType);
    liveAudioService.triggerHaptic([20, 35, 20]);

    if (giftEvt.targetSeatIndex !== undefined && giftEvt.targetSeatIndex >= 0) {
      setHighlightedSeatIndex(giftEvt.targetSeatIndex);
      setTimeout(() => setHighlightedSeatIndex(null), 4500);
    }

    setTimeout(() => {
      setActiveGiftEvent((current) => (current?.id === giftEvt.id ? null : current));
    }, 4000);
  };

  // Send virtual gift
  const sendGift = async (gift: LiveGift, recipientProfile: Profile, targetSeatIdx?: number) => {
    if (!room || !currentUser) return { success: false, error: 'Not in room' };

    try {
      const res = await fetch('/api/live/gifts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          sender: currentUser,
          recipient: recipientProfile,
          giftId: gift.id,
          targetSeatIndex: targetSeatIdx,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || data.error };
      }

      if (data.giftEvent) {
        triggerGiftEffects(data.giftEvent);
        // Deduct coins locally in storage and award XP
        LiveStorageService.deductCoins(
          currentUser.id,
          gift.coins,
          `Sent ${gift.name} ${gift.icon} to ${recipientProfile.display_name}`
        );
        fetchRoomState();
        return { success: true, giftEvent: data.giftEvent };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Gift sending failed' };
    }
    return { success: false, error: 'Unknown error' };
  };

  // Send chat message
  const sendMessage = async (content: string) => {
    if (!room || !currentUser || !content.trim()) return;
    try {
      const res = await fetch('/api/live/rooms/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          sender: currentUser,
          content: content.trim(),
          type: 'text',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setChatMessages((prev) => [...prev, data.message]);
          // Award chat XP
          LiveStorageService.addXp(currentUser.id, 2);
        }
      }
    } catch (e) {}
  };

  // Send floating reaction
  const sendReaction = async (emoji: string) => {
    if (!room || !currentUser) return;
    const newRx: FloatingReaction = {
      id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      x: Math.floor(Math.random() * 80) + 10,
      senderName: currentUser.display_name,
    };
    setFloatingReactions((prev) => [...prev.slice(-15), newRx]);
    liveAudioService.triggerHaptic([10]);

    try {
      fetch('/api/live/rooms/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          emoji,
          senderName: currentUser.display_name,
        }),
      }).catch(() => {});
    } catch {}
  };

  // Seat management actions
  const takeSeat = async (seatIndex: number) => {
    if (!room || !currentUser) return;
    try {
      const res = await fetch('/api/live/rooms/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: 'take_seat',
          userId: currentUser.id,
          userProfile: currentUser,
          seatIndex,
        }),
      });
      const data = await res.json();
      if (res.ok && data.room) {
        setRoom(data.room);
        liveAudioService.playUiTone('join');
        LiveStorageService.addXp(currentUser.id, 10);
      }
    } catch (e) {}
  };

  const leaveSeat = async () => {
    if (!room || !currentUser) return;
    try {
      const res = await fetch('/api/live/rooms/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: 'leave_seat',
          userId: currentUser.id,
          userProfile: currentUser,
        }),
      });
      const data = await res.json();
      if (res.ok && data.room) {
        setRoom(data.room);
        liveAudioService.playUiTone('leave');
      }
    } catch (e) {}
  };

  // Leave room completely
  const leaveRoom = async () => {
    if (room && currentUser) {
      try {
        await fetch('/api/live/rooms/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            action: 'leave',
            userId: currentUser.id,
            userProfile: currentUser,
          }),
        });
      } catch (e) {}
    }
    liveAudioService.stopMicrophone();
    if (localMusicAudioRef.current) {
      localMusicAudioRef.current.pause();
      localMusicAudioRef.current.src = '';
    }
    setRoom(null);
    setIsMinimized(false);
  };

  // Local Music Player Handlers
  const handleSelectLocalMusicFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const audioFiles = Array.from(files).filter((f) => f.type.startsWith('audio/'));
    if (audioFiles.length === 0) return;

    setLocalMusicPlaylist(audioFiles);
    setCurrentTrackIndex(0);
    playLocalTrack(audioFiles[0]);
  };

  const playLocalTrack = (file: File) => {
    if (!localMusicAudioRef.current) {
      localMusicAudioRef.current = new Audio();
    }
    const audio = localMusicAudioRef.current;
    const objUrl = URL.createObjectURL(file);
    audio.src = objUrl;
    audio.volume = musicVolume;
    audio.play().catch(() => {});

    // Broadcast music state to room
    if (room && currentUser && canPlayMusic) {
      const musicState: LiveRoomMusicState = {
        songTitle: file.name,
        isPlaying: true,
        currentTime: 0,
        duration: 200,
        playedBy: { id: currentUser.id, name: currentUser.display_name },
        updatedAt: Date.now(),
      };
      fetch('/api/live/rooms/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          userId: currentUser.id,
          musicState,
        }),
      }).catch(() => {});
    }
  };

  const togglePlayPauseMusic = () => {
    const audio = localMusicAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    if (room && currentUser && canPlayMusic) {
      const currentTrack = localMusicPlaylist[currentTrackIndex];
      const musicState: LiveRoomMusicState = {
        songTitle: currentTrack ? currentTrack.name : room.currentMusic?.songTitle || 'Local Track',
        isPlaying: !audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration || 200,
        playedBy: { id: currentUser.id, name: currentUser.display_name },
        updatedAt: Date.now(),
      };
      fetch('/api/live/rooms/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          userId: currentUser.id,
          musicState,
        }),
      }).catch(() => {});
    }
  };

  const nextTrack = () => {
    if (localMusicPlaylist.length === 0) return;
    const nextIdx = (currentTrackIndex + 1) % localMusicPlaylist.length;
    setCurrentTrackIndex(nextIdx);
    playLocalTrack(localMusicPlaylist[nextIdx]);
  };

  const prevTrack = () => {
    if (localMusicPlaylist.length === 0) return;
    const prevIdx = (currentTrackIndex - 1 + localMusicPlaylist.length) % localMusicPlaylist.length;
    setCurrentTrackIndex(prevIdx);
    playLocalTrack(localMusicPlaylist[prevIdx]);
  };

  const setAudioVolume = (vol: number) => {
    setMusicVolume(vol);
    if (localMusicAudioRef.current) {
      localMusicAudioRef.current.volume = vol;
    }
  };

  // Perform room moderation action
  const performRoomAction = async (action: string, targetUserId?: string, seatIdx?: number, payload?: any) => {
    if (!room || !currentUser) return;
    try {
      const res = await fetch('/api/live/rooms/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action,
          userId: currentUser.id,
          userProfile: currentUser,
          targetUserId,
          seatIndex: seatIdx,
          payload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.room) {
        setRoom(data.room);
      }
      return data;
    } catch (e) {}
  };

  return {
    room,
    setRoom,
    isMinimized,
    setIsMinimized,
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
    // Local Music Controls
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
  };
}
