import {
  getAllLiveRooms,
  getLiveRoomByIdOrRoomId,
  createNewLiveRoom,
  liveRoomsStore,
  liveRoomChatStore,
  liveRoomReactionsStore,
  liveGiftEventsStore,
  userCoinBalancesStore,
  liveRoomSignalsStore,
  persistLiveRoomsToDisk,
  recalculateEngagement,
} from './server-live-state';
import { LIVE_GIFT_CATALOG, LiveGiftEvent, LiveChatMessage } from '../../types/live';

export async function handleLiveApiRequest(
  url: string,
  method: string,
  body: any,
  serverSupabase?: any
): Promise<{ status: number; data: any } | null> {
  // 1. List Live Rooms
  if (url === '/api/live/rooms/list' && method === 'POST') {
    const { filter = 'trending', category = 'all', search = '' } = body || {};
    let rooms = getAllLiveRooms();

    // Category filter
    if (category && category !== 'all') {
      rooms = rooms.filter((r) => r.category === category);
    }

    // Search query (matches name, description, tags, or exact roomId)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rooms = rooms.filter(
        (r) =>
          r.roomId.toLowerCase() === q ||
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Ranking and sorting based on real activity / engagement
    if (filter === 'trending' || filter === 'popular') {
      rooms.sort((a, b) => b.engagementScore - a.engagementScore);
    } else if (filter === 'new') {
      rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (filter === 'recommended') {
      // Balance between active speakers and audience
      rooms.sort((a, b) => {
        const aOccupied = a.seats.filter((s) => s.user !== null).length;
        const bOccupied = b.seats.filter((s) => s.user !== null).length;
        return (bOccupied * 50 + b.onlineCount) - (aOccupied * 50 + a.onlineCount);
      });
    }

    return { status: 200, data: { rooms } };
  }

  // 2. Create Live Room
  if (url === '/api/live/rooms/create' && method === 'POST') {
    const { name, description, category, tags, photoUrl, owner, isPrivate } = body || {};
    if (!name || !owner || !owner.id) {
      return { status: 400, data: { error: 'Room name and valid owner profile required' } };
    }
    const room = createNewLiveRoom({
      name,
      description,
      category: category || 'chat',
      tags,
      photoUrl,
      owner,
      isPrivate: Boolean(isPrivate),
    });
    return { status: 200, data: { success: true, room } };
  }

  // 3. Get Live Room
  if (url === '/api/live/rooms/get' && method === 'POST') {
    const { identifier } = body || {};
    if (!identifier) {
      return { status: 400, data: { error: 'Room identifier (id or roomId) required' } };
    }
    const room = getLiveRoomByIdOrRoomId(identifier);
    if (!room) {
      return { status: 404, data: { error: 'Live room not found' } };
    }
    recalculateEngagement(room);
    const chats = liveRoomChatStore.get(room.id) || [];
    const gifts = liveGiftEventsStore.get(room.id) || [];
    return { status: 200, data: { room, recentChats: chats.slice(-60), recentGifts: gifts.slice(-15) } };
  }

  // 4. Room Actions (Join, Leave, Seats, Moderation, Admin Appointment)
  if (url === '/api/live/rooms/action' && method === 'POST') {
    const { roomId, action, userId, userProfile, targetUserId, seatIndex, payload } = body || {};
    if (!roomId || !action) {
      return { status: 400, data: { error: 'roomId and action required' } };
    }

    const room = getLiveRoomByIdOrRoomId(roomId);
    if (!room) {
      return { status: 404, data: { error: 'Live room not found' } };
    }

    const isOwner = userId && room.ownerId === userId;
    const isAdmin = userId && room.adminId === userId;

    const addSystemMessage = (text: string) => {
      const msgs = liveRoomChatStore.get(room.id) || [];
      const newMsg: LiveChatMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        roomId: room.id,
        sender: {
          id: 'system',
          username: 'system',
          display_name: 'Room Alert',
          avatar_url: null,
          bio: null,
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        content: text,
        type: 'system',
        createdAt: new Date().toISOString(),
      };
      liveRoomChatStore.set(room.id, [...msgs.slice(-90), newMsg]);
    };

    switch (action) {
      case 'join': {
        if (room.bannedUserIds.includes(userId)) {
          return { status: 403, data: { error: 'You are banned from this room' } };
        }
        if (room.isPrivate && !isOwner && !isAdmin) {
          // If private and not yet approved
          const isApproved = !room.pendingJoinRequests.some((r) => r.user.id === userId);
          if (room.isPrivate && payload?.requestPrivate) {
            if (!room.pendingJoinRequests.some((r) => r.user.id === userId) && userProfile) {
              room.pendingJoinRequests.push({ user: userProfile, requestedAt: new Date().toISOString() });
              addSystemMessage(`${userProfile.display_name} knocked to enter this private room.`);
            }
            return { status: 200, data: { success: true, pendingApproval: true, room } };
          }
        }
        if (userProfile && !room.audience.some((u) => u.id === userId) && !room.seats.some((s) => s.user?.id === userId)) {
          room.audience.push(userProfile);
          room.onlineCount = Math.max(room.onlineCount, room.audience.length + room.seats.filter((s) => s.user).length);
          addSystemMessage(`${userProfile.display_name} joined the room.`);
        }
        break;
      }

      case 'leave': {
        // Remove from audience
        room.audience = room.audience.filter((u) => u.id !== userId);
        // Vacate seat if occupied
        room.seats.forEach((seat) => {
          if (seat.user?.id === userId) {
            seat.user = null;
            seat.isSpeaking = false;
            seat.isMuted = false;
          }
        });
        room.onlineCount = Math.max(1, room.audience.length + room.seats.filter((s) => s.user).length);
        if (userProfile) {
          addSystemMessage(`${userProfile.display_name} left the room.`);
        }
        break;
      }

      case 'take_seat': {
        if (seatIndex === undefined || seatIndex < 0 || seatIndex > 7) {
          return { status: 400, data: { error: 'Valid seatIndex (0-7) required' } };
        }
        if (room.bannedUserIds.includes(userId)) {
          return { status: 403, data: { error: 'You are banned from this room' } };
        }
        const seat = room.seats[seatIndex];
        if (seat.isLocked && !isOwner && !isAdmin) {
          return { status: 403, data: { error: 'This seat is locked by host' } };
        }
        if (seat.user && seat.user.id !== userId) {
          return { status: 400, data: { error: 'Seat is already occupied' } };
        }
        // Vacate previous seat if any
        room.seats.forEach((s) => {
          if (s.user?.id === userId) {
            s.user = null;
            s.isSpeaking = false;
          }
        });
        // Remove from audience list since now seated
        room.audience = room.audience.filter((u) => u.id !== userId);
        // Occupy target seat
        seat.user = userProfile || { id: userId, display_name: 'Speaker', username: 'speaker' } as any;
        seat.isMuted = room.mutedUserIds.includes(userId);
        seat.isSpeaking = false;
        seat.joinedAt = new Date().toISOString();
        addSystemMessage(`${seat.user!.display_name} took Seat ${seatIndex + 1} 🎙️`);
        break;
      }

      case 'leave_seat': {
        room.seats.forEach((s) => {
          if (s.user?.id === userId) {
            s.user = null;
            s.isSpeaking = false;
            s.isMuted = false;
          }
        });
        if (userProfile && !room.audience.some((u) => u.id === userId)) {
          room.audience.push(userProfile);
        }
        if (userProfile) {
          addSystemMessage(`${userProfile.display_name} moved to audience.`);
        }
        break;
      }

      case 'mute_seat': {
        // Owner or Admin with canMute permission
        if (!isOwner && (!isAdmin || !room.adminPermissions.canMute)) {
          return { status: 403, data: { error: 'Permission denied to mute' } };
        }
        if (targetUserId) {
          if (!room.mutedUserIds.includes(targetUserId)) {
            room.mutedUserIds.push(targetUserId);
          }
          room.seats.forEach((s) => {
            if (s.user?.id === targetUserId) {
              s.isMuted = true;
              s.isSpeaking = false;
            }
          });
          addSystemMessage(`User was muted by ${isOwner ? 'Owner' : 'Admin'}.`);
        }
        break;
      }

      case 'unmute_seat': {
        if (!isOwner && (!isAdmin || !room.adminPermissions.canMute)) {
          return { status: 403, data: { error: 'Permission denied to unmute' } };
        }
        if (targetUserId) {
          room.mutedUserIds = room.mutedUserIds.filter((id) => id !== targetUserId);
          room.seats.forEach((s) => {
            if (s.user?.id === targetUserId) {
              s.isMuted = false;
            }
          });
          addSystemMessage(`User microphone was unmuted.`);
        }
        break;
      }

      case 'kick_user': {
        if (!isOwner && (!isAdmin || !room.adminPermissions.canKick)) {
          return { status: 403, data: { error: 'Permission denied to kick' } };
        }
        if (targetUserId === room.ownerId) {
          return { status: 400, data: { error: 'Cannot kick room owner' } };
        }
        room.seats.forEach((s) => {
          if (s.user?.id === targetUserId) {
            s.user = null;
            s.isSpeaking = false;
          }
        });
        room.audience = room.audience.filter((u) => u.id !== targetUserId);
        addSystemMessage(`A user was removed from the room.`);
        break;
      }

      case 'ban_user': {
        if (!isOwner && (!isAdmin || !room.adminPermissions.canBan)) {
          return { status: 403, data: { error: 'Permission denied to ban' } };
        }
        if (targetUserId === room.ownerId) {
          return { status: 400, data: { error: 'Cannot ban room owner' } };
        }
        if (!room.bannedUserIds.includes(targetUserId)) {
          room.bannedUserIds.push(targetUserId);
        }
        room.seats.forEach((s) => {
          if (s.user?.id === targetUserId) {
            s.user = null;
            s.isSpeaking = false;
          }
        });
        room.audience = room.audience.filter((u) => u.id !== targetUserId);
        addSystemMessage(`A user was banned from this room.`);
        break;
      }

      case 'lock_seat': {
        if (!isOwner && (!isAdmin || !room.adminPermissions.canLockSeats)) {
          return { status: 403, data: { error: 'Permission denied to lock seat' } };
        }
        if (seatIndex !== undefined && room.seats[seatIndex]) {
          room.seats[seatIndex].isLocked = true;
          addSystemMessage(`Seat ${seatIndex + 1} locked.`);
        }
        break;
      }

      case 'unlock_seat': {
        if (!isOwner && (!isAdmin || !room.adminPermissions.canLockSeats)) {
          return { status: 403, data: { error: 'Permission denied to unlock seat' } };
        }
        if (seatIndex !== undefined && room.seats[seatIndex]) {
          room.seats[seatIndex].isLocked = false;
          addSystemMessage(`Seat ${seatIndex + 1} unlocked.`);
        }
        break;
      }

      // Appoint exactly 1 Admin (Owner only)
      case 'appoint_admin': {
        if (!isOwner) {
          return { status: 403, data: { error: 'Only room Owner can appoint Admin' } };
        }
        if (!payload?.targetUser) {
          return { status: 400, data: { error: 'Target user profile required' } };
        }
        if (payload.targetUser.id === room.ownerId) {
          return { status: 400, data: { error: 'Owner cannot be appointed as Admin' } };
        }
        room.adminId = payload.targetUser.id;
        room.admin = payload.targetUser;
        if (payload.permissions) {
          room.adminPermissions = { ...room.adminPermissions, ...payload.permissions };
        }
        addSystemMessage(`🛡️ ${payload.targetUser.display_name} has been appointed as Room Admin!`);
        break;
      }

      // Remove Admin (Owner only)
      case 'remove_admin': {
        if (!isOwner) {
          return { status: 403, data: { error: 'Only room Owner can remove Admin' } };
        }
        const oldAdminName = room.admin?.display_name || 'Admin';
        room.adminId = null;
        room.admin = null;
        addSystemMessage(`${oldAdminName} was removed as Room Admin.`);
        break;
      }

      // Update Admin Permissions (Owner only)
      case 'update_admin_permissions': {
        if (!isOwner) {
          return { status: 403, data: { error: 'Only room Owner can update Admin permissions' } };
        }
        if (payload?.permissions) {
          room.adminPermissions = { ...room.adminPermissions, ...payload.permissions };
          addSystemMessage(`Room Admin permissions updated by Owner.`);
        }
        break;
      }

      // Update Room Info (Owner only)
      case 'update_room_info': {
        if (!isOwner) {
          return { status: 403, data: { error: 'Only Owner can edit room details' } };
        }
        if (payload?.name) room.name = payload.name;
        if (payload?.description !== undefined) room.description = payload.description;
        if (payload?.photoUrl !== undefined) room.photoUrl = payload.photoUrl;
        if (payload?.category) room.category = payload.category;
        if (payload?.isPrivate !== undefined) room.isPrivate = payload.isPrivate;
        addSystemMessage(`Room details updated by host.`);
        break;
      }

      // Transfer Ownership (Owner only)
      case 'transfer_ownership': {
        if (!isOwner) {
          return { status: 403, data: { error: 'Only current Owner can transfer ownership' } };
        }
        if (!payload?.newOwner) {
          return { status: 400, data: { error: 'New owner profile required' } };
        }
        room.ownerId = payload.newOwner.id;
        room.owner = payload.newOwner;
        if (room.adminId === payload.newOwner.id) {
          room.adminId = null;
          room.admin = null;
        }
        addSystemMessage(`👑 Room ownership transferred to ${payload.newOwner.display_name}!`);
        break;
      }

      // Close Room (Owner only)
      case 'close_room': {
        if (!isOwner) {
          return { status: 403, data: { error: 'Only Owner can close the room' } };
        }
        room.isClosed = true;
        addSystemMessage(`Room has been closed by Owner.`);
        break;
      }

      // Approve Private Knock Request
      case 'approve_private_join': {
        if (!isOwner && !isAdmin) {
          return { status: 403, data: { error: 'Permission denied' } };
        }
        if (targetUserId) {
          const reqItem = room.pendingJoinRequests.find((r) => r.user.id === targetUserId);
          room.pendingJoinRequests = room.pendingJoinRequests.filter((r) => r.user.id !== targetUserId);
          if (reqItem && !room.audience.some((u) => u.id === targetUserId)) {
            room.audience.push(reqItem.user);
            addSystemMessage(`${reqItem.user.display_name} was approved to enter.`);
          }
        }
        break;
      }

      // Reject Private Knock Request
      case 'reject_private_join': {
        if (!isOwner && !isAdmin) {
          return { status: 403, data: { error: 'Permission denied' } };
        }
        if (targetUserId) {
          room.pendingJoinRequests = room.pendingJoinRequests.filter((r) => r.user.id !== targetUserId);
        }
        break;
      }

      // Speaker status update (real-time voice ripple)
      case 'set_speaking': {
        const isSpeaking = Boolean(payload?.isSpeaking);
        room.seats.forEach((s) => {
          if (s.user?.id === userId) {
            s.isSpeaking = isSpeaking;
          }
        });
        break;
      }

      default:
        return { status: 400, data: { error: `Unknown action ${action}` } };
    }

    room.updatedAt = new Date().toISOString();
    recalculateEngagement(room);
    persistLiveRoomsToDisk();
    return { status: 200, data: { success: true, room } };
  }

  // 5. Send Room Chat Message
  if (url === '/api/live/rooms/chat' && method === 'POST') {
    const { roomId, sender, content, type = 'text' } = body || {};
    if (!roomId || !sender || !content) {
      return { status: 400, data: { error: 'roomId, sender and content required' } };
    }

    const room = getLiveRoomByIdOrRoomId(roomId);
    if (!room) {
      return { status: 404, data: { error: 'Room not found' } };
    }

    // Determine badge
    let badge: 'owner' | 'admin' | 'seat' | 'vip' | null = null;
    if (sender.id === room.ownerId) {
      badge = 'owner';
    } else if (sender.id === room.adminId) {
      badge = 'admin';
    } else if (room.seats.some((s) => s.user?.id === sender.id)) {
      badge = 'seat';
    }

    const newMsg: LiveChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomId: room.id,
      sender,
      content,
      type,
      badge,
      createdAt: new Date().toISOString(),
    };

    const chats = liveRoomChatStore.get(room.id) || [];
    liveRoomChatStore.set(room.id, [...chats.slice(-90), newMsg]);
    recalculateEngagement(room);

    return { status: 200, data: { success: true, message: newMsg } };
  }

  // 6. Send Floating Reactions
  if (url === '/api/live/rooms/reactions' && method === 'POST') {
    const { roomId, emoji, senderName } = body || {};
    if (!roomId || !emoji) {
      return { status: 400, data: { error: 'roomId and emoji required' } };
    }
    const reactions = liveRoomReactionsStore.get(roomId) || [];
    const newReaction = {
      id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      x: Math.floor(Math.random() * 80) + 10,
      senderName: senderName || 'User',
      timestamp: Date.now(),
    };
    liveRoomReactionsStore.set(roomId, [...reactions.slice(-30), newReaction]);
    return { status: 200, data: { success: true, reaction: newReaction } };
  }

  // 7. Sync Local Music (Synchronized across all room participants)
  if (url === '/api/live/rooms/music' && method === 'POST') {
    const { roomId, userId, musicState } = body || {};
    const room = getLiveRoomByIdOrRoomId(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };

    const isOwner = userId === room.ownerId;
    const isAdminWithPerm = userId === room.adminId && room.adminPermissions.canPlayMusic;

    if (!isOwner && !isAdminWithPerm) {
      return { status: 403, data: { error: 'Music playback permission denied. Only Owner or authorized Admin can play music.' } };
    }

    room.currentMusic = musicState ? { ...musicState, updatedAt: Date.now() } : null;
    room.updatedAt = new Date().toISOString();
    recalculateEngagement(room);

    return { status: 200, data: { success: true, currentMusic: room.currentMusic } };
  }

  // 8. Interactive Activities & Games (Quiz, Emoji Guess, Word Game, Poll)
  if (url === '/api/live/rooms/games' && method === 'POST') {
    const { roomId, action, activityData, userId, optionIndex, timeMs } = body || {};
    const room = getLiveRoomByIdOrRoomId(roomId);
    if (!room) return { status: 404, data: { error: 'Room not found' } };

    if (action === 'start') {
      const isOwner = userId === room.ownerId;
      const isAdminWithPerm = userId === room.adminId && room.adminPermissions.canManageGames;
      if (!isOwner && !isAdminWithPerm) {
        return { status: 403, data: { error: 'Permission denied to start activity' } };
      }
      room.currentActivity = {
        id: `act_${Date.now()}`,
        type: activityData.type,
        title: activityData.title,
        startedBy: activityData.startedBy,
        startedAt: new Date().toISOString(),
        data: activityData.data,
        votes: {},
        answeredUsers: {},
        isActive: true,
      };
      // Announce in chat
      const chats = liveRoomChatStore.get(room.id) || [];
      chats.push({
        id: `chat_game_${Date.now()}`,
        roomId: room.id,
        sender: activityData.startedBy,
        content: `🎮 New interactive activity started: "${activityData.title}"! Tap to participate!`,
        type: 'game',
        createdAt: new Date().toISOString(),
      });
      liveRoomChatStore.set(room.id, chats);
      return { status: 200, data: { success: true, activity: room.currentActivity } };
    }

    if (action === 'vote' && room.currentActivity) {
      if (!room.currentActivity.votes) room.currentActivity.votes = {};
      room.currentActivity.votes[userId] = optionIndex;
      return { status: 200, data: { success: true, activity: room.currentActivity } };
    }

    if (action === 'answer' && room.currentActivity) {
      if (!room.currentActivity.answeredUsers) room.currentActivity.answeredUsers = {};
      const correctIdx = room.currentActivity.data.correctIndex;
      const isCorrect = optionIndex === correctIdx;
      room.currentActivity.answeredUsers[userId] = {
        optionIndex,
        isCorrect,
        timeMs: timeMs || 3000,
      };
      return { status: 200, data: { success: true, isCorrect, activity: room.currentActivity } };
    }

    if (action === 'end' && room.currentActivity) {
      room.currentActivity.isActive = false;
      return { status: 200, data: { success: true } };
    }

    return { status: 400, data: { error: 'Unknown game action' } };
  }

  // 9. Send Virtual Gift (Server-side coin validation, deduction, and broadcasting)
  if (url === '/api/live/gifts/send' && method === 'POST') {
    const { roomId, sender, recipient, giftId, targetSeatIndex } = body || {};
    if (!roomId || !sender || !recipient || !giftId) {
      return { status: 400, data: { error: 'roomId, sender, recipient and giftId required' } };
    }

    const gift = LIVE_GIFT_CATALOG.find((g) => g.id === giftId);
    if (!gift) {
      return { status: 404, data: { error: 'Invalid gift' } };
    }

    // Check balance in store
    const currentBalance = userCoinBalancesStore.get(sender.id) ?? 1200;
    if (currentBalance < gift.coins) {
      return {
        status: 400,
        data: {
          error: 'INSUFFICIENT_COINS',
          message: `Insufficient coins balance. You have ${currentBalance} coins, need ${gift.coins} coins.`,
          required: gift.coins,
          balance: currentBalance,
        },
      };
    }

    // Deduct coins atomically
    const newBalance = currentBalance - gift.coins;
    userCoinBalancesStore.set(sender.id, newBalance);

    // Credit recipient
    const recipientBal = userCoinBalancesStore.get(recipient.id) ?? 1200;
    userCoinBalancesStore.set(recipient.id, recipientBal + gift.coins);

    const giftEvent: LiveGiftEvent = {
      id: `gift_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      gift,
      sender,
      recipient,
      roomId,
      targetSeatIndex,
      timestamp: Date.now(),
    };

    const roomGifts = liveGiftEventsStore.get(roomId) || [];
    liveGiftEventsStore.set(roomId, [...roomGifts.slice(-40), giftEvent]);

    // Add gift announcement in chat
    const chats = liveRoomChatStore.get(roomId) || [];
    const chatMsg: LiveChatMessage = {
      id: `chat_gift_${Date.now()}`,
      roomId,
      sender,
      content: `Sent ${gift.name} ${gift.icon} to ${recipient.display_name}!`,
      type: 'gift',
      giftMeta: {
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        coinCost: gift.coins,
        recipientId: recipient.id,
        recipientName: recipient.display_name,
      },
      createdAt: new Date().toISOString(),
    };
    liveRoomChatStore.set(roomId, [...chats.slice(-90), chatMsg]);

    const room = getLiveRoomByIdOrRoomId(roomId);
    if (room) recalculateEngagement(room);

    return {
      status: 200,
      data: {
        success: true,
        giftEvent,
        newBalance,
      },
    };
  }

  // 10. Buy Coins / Balance
  if (url === '/api/live/coins/buy' && method === 'POST') {
    const { userId, packageId, coins, bonusCoins = 0 } = body || {};
    if (!userId || !coins) {
      return { status: 400, data: { error: 'userId and coins required' } };
    }
    const current = userCoinBalancesStore.get(userId) ?? 1200;
    const added = Number(coins) + Number(bonusCoins);
    const updated = current + added;
    userCoinBalancesStore.set(userId, updated);
    return {
      status: 200,
      data: {
        success: true,
        packageId,
        coinsAdded: added,
        newBalance: updated,
      },
    };
  }

  // 11. WebRTC Live Room Audio Signaling Relay (Multi-peer seat audio)
  if (url === '/api/live/rooms/signal' && method === 'POST') {
    const { roomId, senderId, targetId, type, sdp, candidate } = body || {};
    if (roomId && targetId) {
      const key = `${roomId}_${targetId}`;
      const existing = liveRoomSignalsStore.get(key) || [];
      liveRoomSignalsStore.set(key, [
        ...existing.slice(-50),
        {
          id: `lvsig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roomId,
          senderId,
          targetId,
          type,
          sdp,
          candidate,
          timestamp: Date.now(),
        },
      ]);
    }
    return { status: 200, data: { success: true } };
  }

  // 12. Retrieve WebRTC Live Room Signals
  if (url === '/api/live/rooms/signals' && method === 'POST') {
    const { roomId, targetId } = body || {};
    if (!roomId || !targetId) {
      return { status: 200, data: { signals: [] } };
    }
    const key = `${roomId}_${targetId}`;
    const signals = liveRoomSignalsStore.get(key) || [];
    liveRoomSignalsStore.set(key, []);
    return { status: 200, data: { signals } };
  }

  // 13. Real Community Profiles from Database (for room invites and discovery)
  if ((url === '/api/live/community' || url === '/api/live/community/list') && (method === 'GET' || method === 'POST')) {
    try {
      if (serverSupabase) {
        const { data: profiles, error } = await serverSupabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio, is_online, last_seen, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(40);

        if (!error && profiles) {
          return { status: 200, data: { profiles } };
        }
      }
    } catch (e) {
      console.warn('Live community fetch notice:', e);
    }
    return { status: 200, data: { profiles: [] } };
  }

  return null;
}
