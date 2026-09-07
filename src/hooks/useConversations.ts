import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { Conversation, Profile, Message } from '@/src/types';
import { notificationService } from '@/src/lib/notification-service';

function getLocalConvCacheKey(userId?: string) {
  return `liveconnect_convs_${userId || 'anon'}`;
}

function getDeletedConvsKey(userId?: string) {
  return `liveconnect_deleted_convs_${userId || 'anon'}`;
}

function loadDeletedConvIds(userId?: string): Set<string> {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    const raw = localStorage.getItem(getDeletedConvsKey(userId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {}
  return new Set();
}

function recordDeletedConvId(userId: string | undefined, convId: string) {
  if (typeof window === 'undefined' || !userId || !convId) return;
  try {
    const existing = loadDeletedConvIds(userId);
    existing.add(convId);
    localStorage.setItem(getDeletedConvsKey(userId), JSON.stringify(Array.from(existing)));
  } catch (e) {}
}

function unrecordDeletedConvId(userId: string | undefined, convId: string) {
  if (typeof window === 'undefined' || !userId || !convId) return;
  try {
    const existing = loadDeletedConvIds(userId);
    existing.delete(convId);
    localStorage.setItem(getDeletedConvsKey(userId), JSON.stringify(Array.from(existing)));
  } catch (e) {}
}

function loadLocalConversations(userId?: string): Conversation[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(getLocalConvCacheKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      if (Array.isArray(parsed)) {
        return cleanAndDeduplicateConversations(parsed, userId);
      }
    }
  } catch (e) {
    // ignore
  }
  return [];
}

export function cleanAndDeduplicateConversations(convs: Conversation[], userId?: string): Conversation[] {
  if (!Array.isArray(convs) || convs.length === 0) return [];
  const deleted = loadDeletedConvIds(userId);
  
  const isDbUuid = (id: string | undefined): boolean => {
    return Boolean(
      id &&
      !id.startsWith('dm_') &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
  };

  const directByOtherId = new Map<string, Conversation>();
  const groupConvs = new Map<string, Conversation>();
  const seenIds = new Set<string>();

  for (const c of convs) {
    if (!c || !c.id || deleted.has(c.id)) continue;
    
    // Extract other member id
    let otherMemberId = c.other_member?.id;
    const rawMembers = (c as any).members;
    if (!otherMemberId && Array.isArray(rawMembers) && rawMembers.length > 0) {
      const other = rawMembers.find((m: any) => (m.user_id || m.id) !== userId);
      otherMemberId = other ? (other.user_id || other.id) : undefined;
    }
    if (!otherMemberId && Array.isArray((c as any).member_ids)) {
      const other = (c as any).member_ids.find((id: string) => id !== userId);
      if (other) otherMemberId = other;
    }
    if (!otherMemberId && (c as any).members_meta) {
      const other = Object.keys((c as any).members_meta).find((id: string) => id !== userId);
      if (other) otherMemberId = other;
    }
    if (!otherMemberId && typeof c.id === 'string' && c.id.startsWith('dm_')) {
      const parts = c.id.replace('dm_', '').split('_');
      const other = parts.find((p) => p !== userId);
      if (other) otherMemberId = other;
    }

    const isDirect = c.type === 'direct' || (!c.type && Boolean(otherMemberId)) || Boolean(otherMemberId);

    if (isDirect && otherMemberId) {
      const canonicalId = userId ? getDeterministicDirectConvId(userId, otherMemberId) : c.id;
      const existing = directByOtherId.get(otherMemberId);

      // Prioritize the authoritative database UUID if present
      let chosenId = c.id;
      if (existing) {
        if (isDbUuid(existing.id)) {
          chosenId = existing.id;
        } else if (isDbUuid(c.id)) {
          chosenId = c.id;
        } else {
          chosenId = existing.id || canonicalId;
        }
      } else {
        chosenId = isDbUuid(c.id) ? c.id : canonicalId;
      }

      const existingAliasIds: string[] = (existing as any)?.alias_ids || [];
      const currentAliasIds: string[] = (c as any)?.alias_ids || [];
      const combinedAliases = Array.from(
        new Set([c.id, canonicalId, chosenId, ...existingAliasIds, ...currentAliasIds].filter(Boolean))
      );

      const dbOrigId = isDbUuid(chosenId)
        ? chosenId
        : (isDbUuid(c.id) ? c.id : (isDbUuid(existing?.id) ? existing?.id : undefined));

      if (!existing) {
        directByOtherId.set(otherMemberId, {
          ...c,
          id: chosenId,
          original_id: dbOrigId,
          canonical_id: canonicalId,
          alias_ids: combinedAliases,
        } as any);
      } else {
        // Merge the duplicate conversation objects
        const existingTime = Math.max(
          new Date(existing.updated_at || 0).getTime(),
          new Date(existing.last_message?.created_at || 0).getTime()
        );
        const cTime = Math.max(
          new Date(c.updated_at || 0).getTime(),
          new Date(c.last_message?.created_at || 0).getTime()
        );

        const newestLastMsg = cTime >= existingTime ? (c.last_message || existing.last_message) : (existing.last_message || c.last_message);
        const newestUpdatedAt = cTime >= existingTime ? (c.updated_at || existing.updated_at) : (existing.updated_at || c.updated_at);

        directByOtherId.set(otherMemberId, {
          ...existing,
          ...c,
          id: chosenId,
          original_id: dbOrigId,
          canonical_id: canonicalId,
          alias_ids: combinedAliases,
          other_member: c.other_member || existing.other_member,
          last_message: newestLastMsg,
          updated_at: newestUpdatedAt,
          unread_count: Math.max(existing.unread_count || 0, c.unread_count || 0),
        } as any);
      }
    } else {
      if (!groupConvs.has(c.id)) {
        groupConvs.set(c.id, c);
      }
    }
  }

  const directList = Array.from(directByOtherId.values());
  directList.forEach((d) => seenIds.add(d.id));

  const validGroups = Array.from(groupConvs.values()).filter((g) => !seenIds.has(g.id));

  const merged = [...directList, ...validGroups];

  return merged.sort((a, b) => {
    const timeA = Math.max(new Date(a.updated_at || 0).getTime(), new Date(a.last_message?.created_at || 0).getTime());
    const timeB = Math.max(new Date(b.updated_at || 0).getTime(), new Date(b.last_message?.created_at || 0).getTime());
    return timeB - timeA;
  });
}

function saveLocalConversations(userId: string | undefined, convs: Conversation[]) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const clean = cleanAndDeduplicateConversations(convs, userId);
    localStorage.setItem(getLocalConvCacheKey(userId), JSON.stringify(clean));
  } catch (e) {
    // ignore
  }
}

export function getDeterministicDirectConvId(userA: string, userB: string): string {
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

export function useConversations(currentUserId?: string, activeTab: string = 'messages') {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadLocalConversations(currentUserId)
  );
  const [loading, setLoading] = useState<boolean>(() => loadLocalConversations(currentUserId).length === 0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && currentUserId) {
      return localStorage.getItem(`liveconnect_active_conv_${currentUserId}`) || null;
    }
    return null;
  });

  const activeTabRef = useRef<string>(activeTab);
  activeTabRef.current = activeTab;

  const convRef = useRef<Conversation[]>(conversations);
  convRef.current = conversations;

  const activeConvIdRef = useRef<string | null>(activeConversationId);
  activeConvIdRef.current = activeConversationId;

  // Persist active conversation id
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUserId) {
      if (activeConversationId) {
        localStorage.setItem(`liveconnect_active_conv_${currentUserId}`, activeConversationId);
      }
    }
  }, [activeConversationId, currentUserId]);

  // Keep localStorage in sync with conversations state
  const updateConversationsState = useCallback(
    (updater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
      setConversations((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const clean = cleanAndDeduplicateConversations(next, currentUserId);
        saveLocalConversations(currentUserId, clean);
        return clean;
      });
    },
    [currentUserId]
  );

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    const deletedIds = loadDeletedConvIds(currentUserId);

    try {
      // Step A: Fetch from Server Relay Store (instant sub-second memory sync)
      let serverConvs: Conversation[] = [];
      try {
        const srvRes = await fetch('/api/conversations/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId }),
        });
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (Array.isArray(srvData.conversations)) {
            serverConvs = srvData.conversations.filter((c: Conversation) => !deletedIds.has(c.id));
          }
        }
      } catch (e) {
        // server fetch fallback
      }

      // Step B: Fetch from Supabase
      let populatedConversations: Conversation[] = [];
      try {
        const { data: memberRows, error: memberError } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', currentUserId);

        if (!memberError && memberRows && memberRows.length > 0) {
          const convIds = memberRows.map((m) => m.conversation_id).filter((id) => !deletedIds.has(id));

          const { data: convData } = await supabase
            .from('conversations')
            .select('*')
            .in('id', convIds)
            .order('updated_at', { ascending: false });

          if (convData && convData.length > 0) {
            const { data: allMembersData } = await supabase
              .from('conversation_members')
              .select('conversation_id, user_id')
              .in('conversation_id', convIds);

            const allMembers = allMembersData || [];
            const allUserIds = Array.from(new Set(allMembers.map((m) => m.user_id)));

            let profilesMap: Record<string, Profile> = {};
            if (allUserIds.length > 0) {
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('*')
                .in('id', allUserIds);

              if (profilesData) {
                profilesMap = profilesData.reduce((acc, p) => {
                  acc[p.id] = p;
                  return acc;
                }, {} as Record<string, Profile>);
              }
            }

            const { data: messagesData } = await supabase
              .from('messages')
              .select('*')
              .in('conversation_id', convIds)
              .order('created_at', { ascending: false });

            const allMessageIds = (messagesData || []).map((m) => m.id);
            let readSet = new Set<string>();

            // Include locally cached read message IDs
            try {
              const localReadCache = JSON.parse(localStorage.getItem('lc_read_msgs') || '[]');
              if (Array.isArray(localReadCache)) {
                localReadCache.forEach((id) => readSet.add(id));
              }
            } catch (e) {}

            if (allMessageIds.length > 0) {
              const { data: readsData } = await supabase
                .from('message_reads')
                .select('message_id')
                .eq('user_id', currentUserId)
                .in('message_id', allMessageIds);

              if (readsData) {
                readsData.forEach((r) => readSet.add(r.message_id));
              }
            }

            const lastMessagesMap: Record<string, Message> = {};
            const unreadCountMap: Record<string, number> = {};

            const isCurrentActivelyViewing = (convId: string) => {
              return (
                typeof document !== 'undefined' &&
                !document.hidden &&
                activeTabRef.current === 'messages' &&
                activeConvIdRef.current === convId
              );
            };

            (messagesData || []).forEach((msg) => {
              if (!lastMessagesMap[msg.conversation_id]) {
                lastMessagesMap[msg.conversation_id] = msg as Message;
              }
              const isRead = Boolean(msg.is_read) || readSet.has(msg.id);
              if (
                msg.sender_id !== currentUserId &&
                !isRead &&
                !isCurrentActivelyViewing(msg.conversation_id)
              ) {
                unreadCountMap[msg.conversation_id] = (unreadCountMap[msg.conversation_id] || 0) + 1;
              }
            });

            populatedConversations = convData.map((conv) => {
              const convMembers = allMembers.filter((m) => m.conversation_id === conv.id);
              const otherMemberItem =
                convMembers.find((m) => m.user_id !== currentUserId) ||
                convMembers.find((m) => m.user_id === currentUserId) ||
                convMembers[0];
              const otherProfile = otherMemberItem ? profilesMap[otherMemberItem.user_id] : undefined;

              const existingLocal = convRef.current.find((c) => c.id === conv.id);
              const finalOtherMember = otherProfile || existingLocal?.other_member;
              const isViewingThis = isCurrentActivelyViewing(conv.id);

              return {
                ...conv,
                other_member: finalOtherMember,
                last_message: lastMessagesMap[conv.id] || existingLocal?.last_message,
                unread_count: isViewingThis ? 0 : (unreadCountMap[conv.id] || 0),
              } as Conversation;
            });
          }
        }
      } catch (dbErr) {
        // DB error fallback
      }

      // Step C: Merge serverConvs, populatedConversations, and existing local cache
      const isActivelyViewing = (convId: string) => {
        return (
          typeof document !== 'undefined' &&
          !document.hidden &&
          activeTabRef.current === 'messages' &&
          activeConvIdRef.current === convId
        );
      };

      const combinedMap = new Map<string, Conversation>();

      // Server conversations
      serverConvs.forEach((c) => {
        const uCount = isActivelyViewing(c.id) ? 0 : (c.unread_count || 0);
        combinedMap.set(c.id, { ...c, unread_count: uCount });
      });

      // DB conversations
      populatedConversations.forEach((c) => {
        const existing = combinedMap.get(c.id);
        const uCount = isActivelyViewing(c.id) ? 0 : (c.unread_count || 0);
        if (!existing) {
          combinedMap.set(c.id, { ...c, unread_count: uCount });
        } else {
          const existingUCount = isActivelyViewing(c.id) ? 0 : (existing.unread_count || 0);
          const maxUnread = isActivelyViewing(c.id) ? 0 : Math.max(uCount, existingUCount);
          
          // Always pick the newest message by timestamp between DB and server relay
          let newestLastMsg = existing.last_message;
          if (c.last_message && existing.last_message) {
            const timeC = new Date(c.last_message.created_at || 0).getTime();
            const timeExisting = new Date(existing.last_message.created_at || 0).getTime();
            newestLastMsg = timeC >= timeExisting ? c.last_message : existing.last_message;
          } else if (c.last_message) {
            newestLastMsg = c.last_message;
          }

          combinedMap.set(c.id, {
            ...existing,
            ...c,
            other_member: c.other_member || existing.other_member,
            last_message: newestLastMsg,
            unread_count: maxUnread,
          });
        }
      });

      // Check local message caches for any even newer message (like immediate call log)
      for (const [convId, conv] of combinedMap.entries()) {
        try {
          const raw = localStorage.getItem(`liveconnect_msgs_${convId}`);
          if (raw) {
            const localMsgs = JSON.parse(raw);
            if (Array.isArray(localMsgs) && localMsgs.length > 0) {
              const sorted = [...localMsgs].sort(
                (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
              );
              const newestLocal = sorted[0];
              if (newestLocal) {
                const currentLastTime = new Date(conv.last_message?.created_at || 0).getTime();
                const localLastTime = new Date(newestLocal.created_at || 0).getTime();
                if (localLastTime >= currentLastTime) {
                  conv.last_message = newestLocal;
                  if (localLastTime > new Date(conv.updated_at || 0).getTime()) {
                    conv.updated_at = newestLocal.created_at;
                  }
                }
              }
            }
          }
        } catch (e) {}
      }

      updateConversationsState((prev) => {
        // Keep local optimistic conversations that haven't synced yet (excluding deleted)
        prev.forEach((localConv) => {
          if (!deletedIds.has(localConv.id) && !combinedMap.has(localConv.id)) {
            const uCount = isActivelyViewing(localConv.id) ? 0 : (localConv.unread_count || 0);
            combinedMap.set(localConv.id, { ...localConv, unread_count: uCount });
          }
        });

        return Array.from(combinedMap.values())
          .map((c) => (isActivelyViewing(c.id) ? { ...c, unread_count: 0 } : c))
          .sort((a, b) => {
            const timeA = Math.max(new Date(a.updated_at || 0).getTime(), new Date(a.last_message?.created_at || 0).getTime());
            const timeB = Math.max(new Date(b.updated_at || 0).getTime(), new Date(b.last_message?.created_at || 0).getTime());
            return timeB - timeA;
          });
      });
    } catch (err: any) {
      console.warn('Error fetching conversations:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, updateConversationsState]);

  useEffect(() => {
    if (currentUserId) {
      fetchConversations();

      // High-reliability 1.2s conversation sync
      const pollInterval = setInterval(() => {
        fetchConversations();
      }, 1200);

      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [currentUserId, fetchConversations]);

  // Mark all unread messages in a conversation as read and zero out unread_count
  const markConversationAsRead = useCallback(
    async (conversationId: string) => {
      if (!conversationId || !currentUserId) return;

      // 1. Immediately reset unread count in local state
      updateConversationsState((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );

      // 2. Sync with server relay
      fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: currentUserId }),
      }).catch(() => {});

      const supabase = getSupabase();
      try {
        // 3. Fetch unread messages from other members in this conversation
        const { data: unreadMsgs } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .neq('sender_id', currentUserId);

        if (unreadMsgs && unreadMsgs.length > 0) {
          const unreadIds = unreadMsgs.map((m) => m.id);

          // Cache read IDs in localStorage
          try {
            const currentCache = JSON.parse(localStorage.getItem('lc_read_msgs') || '[]');
            const updatedCache = Array.from(new Set([...currentCache, ...unreadIds])).slice(-500);
            localStorage.setItem('lc_read_msgs', JSON.stringify(updatedCache));
          } catch (e) {}

          const readInserts = unreadIds.map((id) => ({
            message_id: id,
            user_id: currentUserId,
          }));

          // Direct update messages is_read & upsert into message_reads
          await Promise.allSettled([
            supabase.from('messages').update({ is_read: true }).in('id', unreadIds),
            supabase.from('message_reads').upsert(readInserts, { onConflict: 'message_id,user_id' }),
          ]);
        }
      } catch (err: any) {
        console.warn('Notice marking conversation as read:', err.message);
      }
    },
    [currentUserId, updateConversationsState]
  );

  // Realtime subscription for conversation updates and new messages
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = getSupabase();
    const channelId = `convs-rt-${currentUserId}`;

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          const isFromOther = newMsg.sender_id !== currentUserId;
          const isViewing =
            typeof document !== 'undefined' &&
            !document.hidden &&
            activeTabRef.current === 'messages' &&
            activeConvIdRef.current === newMsg.conversation_id;

          if (isFromOther && !isViewing) {
            notificationService.sendNotification({
              title: 'New LiveConnect Message',
              body: newMsg.content || 'You have received a new message.',
              tag: `msg-${newMsg.conversation_id}`,
              onClick: () => {
                setActiveConversationId(newMsg.conversation_id);
              },
            });
          } else if (isViewing) {
            markConversationAsRead(newMsg.conversation_id);
          }

          updateConversationsState((prev) => {
            const exists = prev.some((c) => c.id === newMsg.conversation_id);
            if (!exists) {
              fetchConversations();
              return prev;
            }
            return prev
              .map((c) => {
                if (c.id === newMsg.conversation_id) {
                  return {
                    ...c,
                    updated_at: newMsg.created_at,
                    last_message: newMsg,
                    unread_count: isViewing
                      ? 0
                      : isFromOther
                      ? (c.unread_count || 0) + 1
                      : (c.unread_count || 0),
                  };
                }
                return c;
              })
              .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reads' },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    // Local custom event listener for immediate message/call log updates
    const handleLocalConvMessage = (e: any) => {
      const detail = e.detail;
      if (!detail?.conversationId || !detail?.message) return;
      const newMsg = detail.message as Message;
      const isFromOther = newMsg.sender_id !== currentUserId;
      const isViewing =
        typeof document !== 'undefined' &&
        !document.hidden &&
        activeTabRef.current === 'messages' &&
        activeConvIdRef.current === newMsg.conversation_id;

      updateConversationsState((prev) => {
        const exists = prev.some((c) => c.id === newMsg.conversation_id);
        if (!exists) {
          fetchConversations();
          return prev;
        }
        return prev
          .map((c) => {
            if (c.id === newMsg.conversation_id) {
              return {
                ...c,
                updated_at: newMsg.created_at,
                last_message: newMsg,
                unread_count: isViewing
                  ? 0
                  : isFromOther
                  ? (c.unread_count || 0) + 1
                  : (c.unread_count || 0),
              };
            }
            return c;
          })
          .sort((a, b) => {
            const timeA = Math.max(new Date(a.updated_at || 0).getTime(), new Date(a.last_message?.created_at || 0).getTime());
            const timeB = Math.max(new Date(b.updated_at || 0).getTime(), new Date(b.last_message?.created_at || 0).getTime());
            return timeB - timeA;
          });
      });
    };

    window.addEventListener('liveconnect_conversation_message', handleLocalConvMessage);

    // Background poll fallback every 2.5 seconds to guarantee instant message/conversation delivery
    const syncInterval = setInterval(() => {
      fetchConversations();
    }, 2500);

    return () => {
      window.removeEventListener('liveconnect_conversation_message', handleLocalConvMessage);
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchConversations, updateConversationsState, markConversationAsRead]);

  // Search users by ID, username, or display_name
  const searchUsers = useCallback(async (query: string): Promise<Profile[]> => {
    const cleanQuery = query.trim().replace(/^@/, '');
    if (!currentUserId || !cleanQuery) return [];
    const supabase = getSupabase();

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);

      if (isUUID) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', cleanQuery);

        if (!error && data && data.length > 0) {
          return data as Profile[];
        }
      }

      // Real database text search by username or display name
      const sanitized = cleanQuery.replace(/[%,()]/g, '');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`)
        .limit(30);

      if (!error && data) {
        return data as Profile[];
      }

      // Safe multi-column fallback if .or syntax encounters PostgREST restrictions
      const [byUsername, byDisplayName] = await Promise.all([
        supabase.from('profiles').select('*').ilike('username', `%${sanitized}%`).limit(25),
        supabase.from('profiles').select('*').ilike('display_name', `%${sanitized}%`).limit(25),
      ]);

      const map = new Map<string, Profile>();
      (byUsername.data || []).forEach((u: any) => map.set(u.id, u as Profile));
      (byDisplayName.data || []).forEach((u: any) => map.set(u.id, u as Profile));
      return Array.from(map.values());
    } catch (err: any) {
      console.warn('User search error:', err.message);
      return [];
    }
  }, [currentUserId]);

  // Start or open a direct conversation with target user
  const startConversation = async (targetUserId: string, targetProfileData?: Profile): Promise<string | null> => {
    if (!currentUserId) return null;
    const supabase = getSupabase();
    const isSelfChat = targetUserId === currentUserId;

    try {
      // 1. Generate deterministic Direct Conversation ID
      const newConvId = isSelfChat
        ? getDeterministicDirectConvId(currentUserId, currentUserId)
        : getDeterministicDirectConvId(currentUserId, targetUserId);

      // Revive conversation from deleted tombstone set if user explicitly initiates chat
      unrecordDeletedConvId(currentUserId, newConvId);

      // 2. Fetch target profile info for instant optimistic UI
      let targetProfile = targetProfileData;
      if (!targetProfile) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single();

        if (profData) {
          targetProfile = profData as Profile;
        }
      }

      // 3. Register on Server Relay Store
      fetch('/api/conversations/create-or-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          targetUserId,
          targetProfile,
        }),
      }).catch(() => {});

      // 4. Create optimistic conversation object immediately so UI updates with ZERO delay
      const optimisticConv: Conversation = {
        id: newConvId,
        type: 'direct',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        other_member: targetProfile || {
          id: targetUserId,
          username: isSelfChat ? 'self' : 'user',
          display_name: isSelfChat ? 'Note to Self (You)' : 'User',
          avatar_url: null,
          bio: null,
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        last_message: undefined,
        unread_count: 0,
      };

      updateConversationsState((prev) => [
        optimisticConv,
        ...prev.filter((c) => c.id !== newConvId && c.other_member?.id !== targetUserId),
      ]);
      setActiveConversationId(newConvId);

      // 5. Async sync with Supabase in background
      (async () => {
        try {
          await supabase
            .from('conversations')
            .upsert(
              { id: newConvId, type: 'direct', updated_at: new Date().toISOString() },
              { onConflict: 'id' }
            );

          await supabase
            .from('conversation_members')
            .upsert({ conversation_id: newConvId, user_id: currentUserId }, { onConflict: 'conversation_id,user_id' });

          if (!isSelfChat) {
            await supabase
              .from('conversation_members')
              .upsert({ conversation_id: newConvId, user_id: targetUserId }, { onConflict: 'conversation_id,user_id' });
          }
        } catch (e) {
          // ignore
        }
      })();

      // Trigger background sync
      setTimeout(() => {
        fetchConversations();
      }, 500);

      return newConvId;
    } catch (err: any) {
      console.error('Error starting conversation:', err.message);
      return null;
    }
  };

  // Automatically clear unread badge whenever activeConversationId or activeTab changes (only if viewing messages)
  useEffect(() => {
    if (activeConversationId && activeTab === 'messages') {
      if (typeof document === 'undefined' || !document.hidden) {
        markConversationAsRead(activeConversationId);
      }
    }
  }, [activeConversationId, activeTab, markConversationAsRead]);

  // When user switches back to this browser tab, mark active conversation as read
  useEffect(() => {
    const handleFocus = () => {
      if (
        document.visibilityState === 'visible' &&
        activeConvIdRef.current &&
        activeTabRef.current === 'messages'
      ) {
        markConversationAsRead(activeConvIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [markConversationAsRead]);

  // Delete conversation completely (from DB and local cache)
  const deleteConversation = async (conversationId: string): Promise<boolean> => {
    if (!conversationId) return false;
    const supabase = getSupabase();

    const targetConv = conversations.find((c) => c.id === conversationId);
    const otherMemberId = targetConv?.other_member?.id;
    const canonicalId = (currentUserId && otherMemberId)
      ? getDeterministicDirectConvId(currentUserId, otherMemberId)
      : null;

    try {
      // 1. Immediately record in persistent deleted tombstone store
      recordDeletedConvId(currentUserId, conversationId);
      if (canonicalId) recordDeletedConvId(currentUserId, canonicalId);

      // 2. Immediately remove from local state & cache for instant responsive UI
      updateConversationsState((prev) =>
        prev.filter((c) => c.id !== conversationId && (!canonicalId || c.id !== canonicalId) && (!otherMemberId || c.other_member?.id !== otherMemberId))
      );
      if (activeConversationId === conversationId || activeConversationId === canonicalId) {
        setActiveConversationId(null);
        if (typeof window !== 'undefined' && currentUserId) {
          localStorage.removeItem(`liveconnect_active_conv_${currentUserId}`);
        }
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`liveconnect_msgs_${conversationId}`);
        localStorage.removeItem(`liveconnect_deleted_ids_${conversationId}`);
        if (canonicalId) {
          localStorage.removeItem(`liveconnect_msgs_${canonicalId}`);
          localStorage.removeItem(`liveconnect_deleted_ids_${canonicalId}`);
        }
      }

      // 3. Notify backend server relay to purge from server memory & broadcasts
      fetch('/api/conversations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: currentUserId }),
      }).catch(() => {});

      if (canonicalId && canonicalId !== conversationId) {
        fetch('/api/conversations/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: canonicalId, userId: currentUserId }),
        }).catch(() => {});
      }

      // 4. Delete from Supabase Database in cascading sequence
      (async () => {
        try {
          await supabase.from('messages').delete().eq('conversation_id', conversationId);
          await supabase.from('conversation_members').delete().eq('conversation_id', conversationId);
          await supabase.from('conversations').delete().eq('id', conversationId);
          if (canonicalId && canonicalId !== conversationId) {
            await supabase.from('messages').delete().eq('conversation_id', canonicalId);
            await supabase.from('conversation_members').delete().eq('conversation_id', canonicalId);
            await supabase.from('conversations').delete().eq('id', canonicalId);
          }
        } catch (dbErr: any) {
          console.warn('Database note deleting conversation:', dbErr.message);
        }
      })();

      return true;
    } catch (err: any) {
      console.error('Error deleting conversation:', err.message);
      return false;
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return {
    conversations,
    loading,
    activeConversationId,
    activeConversation,
    setActiveConversationId,
    fetchConversations,
    searchUsers,
    startConversation,
    deleteConversation,
    markConversationAsRead,
  };
}
