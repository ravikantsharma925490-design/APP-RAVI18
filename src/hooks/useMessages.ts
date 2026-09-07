import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { Message, Profile, MessageRead, Conversation } from '@/src/types';
import { generateUUID } from '@/src/lib/utils';
import { uploadMediaToServer } from '@/src/lib/mediaUpload';
import { getDeterministicDirectConvId } from './useConversations';

function getLocalMsgCacheKey(convId: string) {
  return `liveconnect_msgs_${convId}`;
}

function getDeletedMsgIdsKey(convId: string) {
  return `liveconnect_deleted_ids_${convId}`;
}

function loadDeletedMsgIds(convId: string | null): Set<string> {
  if (typeof window === 'undefined' || !convId) return new Set();
  try {
    const raw = localStorage.getItem(getDeletedMsgIdsKey(convId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {}
  return new Set();
}

function recordDeletedMsgId(convId: string | null, msgId: string) {
  if (typeof window === 'undefined' || !convId || !msgId) return;
  try {
    const existing = loadDeletedMsgIds(convId);
    existing.add(msgId);
    localStorage.setItem(getDeletedMsgIdsKey(convId), JSON.stringify(Array.from(existing)));
  } catch (e) {}
}

function recordMultipleDeletedMsgIds(convId: string | null, msgIds: string[]) {
  if (typeof window === 'undefined' || !convId || !msgIds.length) return;
  try {
    const existing = loadDeletedMsgIds(convId);
    msgIds.forEach((id) => existing.add(id));
    localStorage.setItem(getDeletedMsgIdsKey(convId), JSON.stringify(Array.from(existing)));
  } catch (e) {}
}

function cleanAndDeduplicateMessages(msgs: Message[], convId: string | null): Message[] {
  if (!Array.isArray(msgs) || msgs.length === 0) return [];
  const deleted = loadDeletedMsgIds(convId);
  const seenIds = new Set<string>();
  const deduplicated: Message[] = [];

  // Sort chronologically first
  const sorted = [...msgs].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  for (const m of sorted) {
    if (!m || !m.id || deleted.has(m.id)) continue;

    // 1. Direct ID match
    let existingIdx = deduplicated.findIndex((prev) => prev.id === m.id);

    // 2. Call log duplicate match (merges ringing/missed with answered/ended call log for same call)
    if (existingIdx === -1 && m.content?.startsWith('[CALL_LOG:')) {
      existingIdx = deduplicated.findIndex((prev) => {
        if (!prev.content?.startsWith('[CALL_LOG:')) return false;
        const timeDiff = Math.abs(
          new Date(prev.created_at || 0).getTime() - new Date(m.created_at || 0).getTime()
        );
        return timeDiff < 60000; // within 1 minute
      });
    }

    // 3. Duplicate standard message (same sender + identical content within 45 seconds)
    if (existingIdx === -1 && m.sender_id && m.content) {
      existingIdx = deduplicated.findIndex((prev) => {
        if (prev.sender_id !== m.sender_id || prev.content !== m.content) return false;
        const timeDiff = Math.abs(
          new Date(prev.created_at || 0).getTime() - new Date(m.created_at || 0).getTime()
        );
        return timeDiff < 45000;
      });
    }

    if (existingIdx >= 0) {
      const prev = deduplicated[existingIdx];
      // If new message is answered call log or has richer profile data/read receipt, merge in-place
      const isNewAnswered = m.content?.includes(':answered:') && !prev.content?.includes(':answered:');
      const isNewEnded = m.content?.includes(':ended:') && !prev.content?.includes(':ended:');
      const resolvedId = (m.id && !m.id.startsWith('temp_')) ? m.id : prev.id;
      
      deduplicated[existingIdx] = {
        ...prev,
        ...m,
        id: isNewAnswered || isNewEnded ? m.id : resolvedId,
        content: isNewAnswered || isNewEnded ? m.content : (m.content || prev.content),
        sender: m.sender || prev.sender,
        is_read: Boolean(prev.is_read || m.is_read),
      };
      continue;
    }

    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    deduplicated.push(m);
  }

  return deduplicated;
}

function loadLocalMessages(convId: string | null): Message[] {
  if (typeof window === 'undefined' || !convId) return [];
  try {
    const raw = localStorage.getItem(getLocalMsgCacheKey(convId));
    if (raw) {
      const msgs = JSON.parse(raw) as Message[];
      return cleanAndDeduplicateMessages(msgs, convId);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

function loadCombinedLocalMessages(candidateIds: string[]): Message[] {
  if (typeof window === 'undefined' || !candidateIds || candidateIds.length === 0) return [];
  const all: Message[] = [];
  candidateIds.forEach((id) => {
    try {
      const raw = localStorage.getItem(getLocalMsgCacheKey(id));
      if (raw) {
        const msgs = JSON.parse(raw) as Message[];
        if (Array.isArray(msgs)) all.push(...msgs);
      }
    } catch (e) {}
  });
  return cleanAndDeduplicateMessages(all, candidateIds[0] || null);
}

function saveLocalMessages(convId: string | null, msgs: Message[]) {
  if (typeof window === 'undefined' || !convId) return;
  try {
    const clean = cleanAndDeduplicateMessages(msgs, convId);
    localStorage.setItem(getLocalMsgCacheKey(convId), JSON.stringify(clean));
  } catch (e) {
    // ignore
  }
}

export function useMessages(
  conversationId: string | null,
  currentUserId?: string,
  isViewingChat: boolean = true,
  conversationObj?: Conversation | null
) {
  const getCandidateConvIds = useCallback((): string[] => {
    const ids = new Set<string>();
    if (conversationId) ids.add(conversationId);
    if (conversationObj?.id) ids.add(conversationObj.id);
    if ((conversationObj as any)?.original_id) ids.add((conversationObj as any).original_id);
    if ((conversationObj as any)?.canonical_id) ids.add((conversationObj as any).canonical_id);
    if (Array.isArray((conversationObj as any)?.alias_ids)) {
      (conversationObj as any).alias_ids.forEach((id: string) => {
        if (id) ids.add(id);
      });
    }
    if (currentUserId && conversationObj?.other_member?.id) {
      ids.add(getDeterministicDirectConvId(currentUserId, conversationObj.other_member.id));
    }
    return Array.from(ids).filter(Boolean);
  }, [conversationId, conversationObj, currentUserId]);

  const [messages, setMessages] = useState<Message[]>(() => {
    const candidateIds = conversationId
      ? Array.from(
          new Set(
            [
              conversationId,
              conversationObj?.id,
              (conversationObj as any)?.original_id,
              (conversationObj as any)?.canonical_id,
            ].filter(Boolean) as string[]
          )
        )
      : [];
    return loadCombinedLocalMessages(candidateIds);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const candidateIds = conversationId
      ? Array.from(
          new Set(
            [
              conversationId,
              conversationObj?.id,
              (conversationObj as any)?.original_id,
              (conversationObj as any)?.canonical_id,
            ].filter(Boolean) as string[]
          )
        )
      : [];
    const cached = loadCombinedLocalMessages(candidateIds);
    return cached.length === 0 && Boolean(conversationId);
  });
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<any>(null);
  const isViewingChatRef = useRef<boolean>(isViewingChat);
  isViewingChatRef.current = isViewingChat;
  const lastSentContentRef = useRef<{ content: string; time: number } | null>(null);

  // Immediately synchronize messages when conversationId or conversation changes
  useEffect(() => {
    if (conversationId) {
      const candidateIds = getCandidateConvIds();
      const cached = loadCombinedLocalMessages(candidateIds);
      setMessages(cached);
      if (cached.length > 0) {
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setMessages([]);
      setLoading(false);
    }
  }, [conversationId, getCandidateConvIds]);

  // Keep state and localStorage in sync
  const updateMessagesState = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const cleanNext = cleanAndDeduplicateMessages(next, conversationId);
        const candidateIds = getCandidateConvIds();
        candidateIds.forEach((cId) => {
          saveLocalMessages(cId, cleanNext);
        });
        return cleanNext;
      });
    },
    [conversationId, getCandidateConvIds]
  );

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
          block: 'end',
        });
      } catch (e) {
        // fallback
      }
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const candidateIds = getCandidateConvIds();

    // Load from local storage cache first
    const cached = loadCombinedLocalMessages(candidateIds);
    if (cached.length > 0) {
      setMessages(cached);
    }
    const hasCache = cached.length > 0;
    if (!hasCache) {
      setLoading(true);
    }

    const supabase = getSupabase();
    setError(null);

    try {
      const deletedSet = loadDeletedMsgIds(conversationId);

      // If conversationId is a dm_ string, resolve any real DB conversations between the two users
      if (conversationId?.startsWith('dm_')) {
        const parts = conversationId.replace('dm_', '').split('_');
        if (parts.length === 2) {
          try {
            const { data: m1 } = await supabase
              .from('conversation_members')
              .select('conversation_id')
              .eq('user_id', parts[0]);
            if (m1 && m1.length > 0) {
              const cIds = m1.map((m) => m.conversation_id);
              const { data: m2 } = await supabase
                .from('conversation_members')
                .select('conversation_id')
                .in('conversation_id', cIds)
                .eq('user_id', parts[1]);
              if (m2 && m2.length > 0) {
                m2.forEach((m) => {
                  if (!candidateIds.includes(m.conversation_id)) {
                    candidateIds.push(m.conversation_id);
                  }
                });
              }
            }
          } catch (e) {}
        }
      }

      // Run Server Relay fetch and Supabase fetch in PARALLEL
      const [serverRes, supabaseRes] = await Promise.allSettled([
        fetch('/api/messages/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, candidateIds }),
        }).then((res) => (res.ok ? res.json() : null)),
        supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .in('conversation_id', candidateIds)
          .order('created_at', { ascending: true })
          .limit(200),
      ]);

      const idMap = new Map<string, any>();

      // Server messages (already have sender info populated)
      if (serverRes.status === 'fulfilled' && serverRes.value?.messages) {
        serverRes.value.messages.forEach((m: any) => {
          if (!deletedSet.has(m.id)) {
            idMap.set(m.id, m);
          }
        });
      }

      // Supabase messages
      if (supabaseRes.status === 'fulfilled' && Array.isArray(supabaseRes.value?.data)) {
        supabaseRes.value.data.forEach((m: any) => {
          if (!deletedSet.has(m.id)) {
            const prev = idMap.get(m.id);
            idMap.set(m.id, { ...(prev || {}), ...m });
          }
        });
      }

      const rawMessages = Array.from(idMap.values());

      // If any message lacks sender profile, fetch missing profiles in batch
      const missingSenderIds = Array.from(
        new Set(rawMessages.filter((m) => !m.sender).map((m) => m.sender_id))
      );

      let profilesMap: Record<string, Profile> = {};
      if (missingSenderIds.length > 0) {
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', missingSenderIds);

          if (profData) {
            profilesMap = profData.reduce((acc, p) => {
              acc[p.id] = p;
              return acc;
            }, {} as Record<string, Profile>);
          }
        } catch (e) {}
      }

      const isActivelyLooking =
        isViewingChatRef.current && (typeof document === 'undefined' || !document.hidden);

      const formattedRemoteMessages: Message[] = rawMessages.map((m: any) => ({
        ...m,
        sender: m.sender || profilesMap[m.sender_id],
        is_read:
          m.sender_id === currentUserId
            ? Boolean(m.is_read)
            : Boolean(m.is_read) || isActivelyLooking,
      }));

      updateMessagesState((prev) => {
        const currentDeleted = loadDeletedMsgIds(conversationId);
        const remoteIdMap = new Map(
          formattedRemoteMessages
            .filter((m) => !currentDeleted.has(m.id))
            .map((m) => [m.id, m])
        );
        const merged = Array.from(remoteIdMap.values());

        // Keep local optimistic and call log messages
        const now = Date.now();
        prev.forEach((localMsg) => {
          if (!remoteIdMap.has(localMsg.id) && !currentDeleted.has(localMsg.id)) {
            // Check if remote already contains identical message by sender and content
            const alreadyInRemote = Array.from(remoteIdMap.values()).some(
              (rm) =>
                rm.sender_id === localMsg.sender_id &&
                rm.content === localMsg.content &&
                Math.abs(new Date(rm.created_at || 0).getTime() - new Date(localMsg.created_at || 0).getTime()) < 45000
            );
            if (alreadyInRemote) return;

            const isCallLog = localMsg.content?.startsWith('[CALL_LOG:');
            const ageMs = now - new Date(localMsg.created_at || 0).getTime();
            // Preserve call logs or recent pending messages (up to 2 minutes)
            if (isCallLog || ageMs < 120000) {
              merged.push(localMsg);
            }
          }
        });

        return merged.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      scrollToBottom(false);
    } catch (err: any) {
      console.warn('Notice fetching messages:', err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId, scrollToBottom, updateMessagesState]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Mark unread messages from other user as read
  const markMessagesAsRead = useCallback(async () => {
    if (!conversationId || !currentUserId || messages.length === 0) return;

    const supabase = getSupabase();
    const unreadMessages = messages.filter(
      (m) => m.sender_id !== currentUserId && !m.is_read
    );

    if (unreadMessages.length === 0) return;

    try {
      const unreadIds = unreadMessages.map((m) => m.id);

      // 1. Instantly mark as read in local state
      updateMessagesState((prev) =>
        prev.map((msg) =>
          msg.sender_id !== currentUserId ? { ...msg, is_read: true } : msg
        )
      );

      // 2. Cache read IDs in localStorage
      try {
        const currentCache = JSON.parse(localStorage.getItem('lc_read_msgs') || '[]');
        const updatedCache = Array.from(new Set([...currentCache, ...unreadIds])).slice(-500);
        localStorage.setItem('lc_read_msgs', JSON.stringify(updatedCache));
      } catch (e) {}

      // 3. Notify backend server
      fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: currentUserId }),
      }).catch(() => {});

      // 4. Upsert into message_reads in Supabase and update messages is_read
      const readInserts = unreadMessages.map((m) => ({
        message_id: m.id,
        user_id: currentUserId,
      }));

      await Promise.allSettled([
        supabase.from('messages').update({ is_read: true }).in('id', unreadIds),
        supabase.from('message_reads').upsert(readInserts, {
          onConflict: 'message_id,user_id',
        }),
      ]);

      // 5. Broadcast to realtime channel so sender gets instant double blue check!
      if (channelRef.current) {
        channelRef.current
          .send({
            type: 'broadcast',
            event: 'messages_read',
            payload: { conversationId, readerId: currentUserId },
          })
          .catch(() => {});
      }
    } catch (err) {
      console.warn('Silent notice on markMessagesAsRead:', err);
    }
  }, [conversationId, currentUserId, messages, updateMessagesState]);

  // Automatically mark unread messages as read when active/loaded
  useEffect(() => {
    if (!conversationId || !currentUserId || !isViewingChat) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const hasUnread = messages.some((m) => m.sender_id !== currentUserId && !m.is_read);
    if (hasUnread) {
      markMessagesAsRead();
    }
  }, [conversationId, currentUserId, messages, isViewingChat, markMessagesAsRead]);

  // When browser window is refocused or visible, mark messages as read
  useEffect(() => {
    const handleFocus = () => {
      if (
        document.visibilityState === 'visible' &&
        conversationId &&
        currentUserId &&
        isViewingChatRef.current
      ) {
        markMessagesAsRead();
      }
    };
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [conversationId, currentUserId, markMessagesAsRead]);

  // Real-time listener for incoming messages, deletions, and read receipts
  useEffect(() => {
    if (!conversationId) return;

    const supabase = getSupabase();

    const channel = supabase
      .channel(`room-messages-${conversationId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          const deleted = loadDeletedMsgIds(conversationId);
          if (deleted.has(newMsg.id)) return;

          let senderProfile = newMsg.sender;
          if (!senderProfile && newMsg.sender_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newMsg.sender_id)
              .single();
            if (prof) senderProfile = prof;
          }

          const isActivelyViewing =
            isViewingChatRef.current &&
            (typeof document === 'undefined' || !document.hidden);

          if (currentUserId && newMsg.sender_id !== currentUserId && isActivelyViewing) {
            markMessagesAsRead();
          }

          updateMessagesState((prev) => {
            const curDeleted = loadDeletedMsgIds(conversationId);
            if (curDeleted.has(newMsg.id)) return prev;

            // Direct ID match
            const exactIdx = prev.findIndex((m) => m.id === newMsg.id);
            if (exactIdx >= 0) {
              return prev.map((m) =>
                m.id === newMsg.id
                  ? { ...m, ...newMsg, sender: senderProfile || m.sender }
                  : m
              );
            }

            // Optimistic match: same sender + identical content within 45s
            const optIdx = prev.findIndex((m) =>
              m.sender_id === newMsg.sender_id &&
              m.content === newMsg.content &&
              Math.abs(new Date(m.created_at || 0).getTime() - new Date(newMsg.created_at || 0).getTime()) < 45000
            );
            if (optIdx >= 0) {
              const copy = [...prev];
              copy[optIdx] = {
                ...copy[optIdx],
                ...newMsg,
                id: newMsg.id,
                sender: senderProfile || copy[optIdx].sender,
              };
              return copy;
            }

            return [
              ...prev,
              {
                ...newMsg,
                sender: senderProfile,
                is_read:
                  newMsg.sender_id === currentUserId
                    ? Boolean(newMsg.is_read)
                    : isActivelyViewing,
              },
            ];
          });

          setTimeout(() => scrollToBottom(true), 50);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          updateMessagesState((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, is_read: Boolean(updated.is_read) } : m))
          );
        }
      )
      .on(
        'broadcast',
        { event: 'messages_read' },
        (payload) => {
          const targetConvId = payload?.payload?.conversationId || payload?.conversationId;
          const readerId = payload?.payload?.readerId || payload?.readerId;
          if ((!targetConvId || targetConvId === conversationId) && readerId !== currentUserId) {
            updateMessagesState((prev) =>
              prev.map((msg) => (msg.sender_id === currentUserId ? { ...msg, is_read: true } : msg))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            recordDeletedMsgId(conversationId, deletedId);
            updateMessagesState((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .on(
        'broadcast',
        { event: 'message_deleted' },
        (payload) => {
          const deletedId = payload?.payload?.messageId || payload?.messageId;
          if (deletedId) {
            recordDeletedMsgId(conversationId, deletedId);
            updateMessagesState((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .on(
        'broadcast',
        { event: 'messages_cleared' },
        (payload) => {
          const targetConvId = payload?.payload?.conversationId || payload?.conversationId;
          if (!targetConvId || targetConvId === conversationId) {
            updateMessagesState([]);
            if (typeof window !== 'undefined' && conversationId) {
              localStorage.removeItem(getLocalMsgCacheKey(conversationId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          const readData = payload.new as MessageRead;
          updateMessagesState((prev) =>
            prev.map((msg) =>
              msg.id === readData.message_id ? { ...msg, is_read: true } : msg
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Fast polling cycle that synchronizes both sides
    const pollInterval = setInterval(() => {
      fetch('/api/messages/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.messages && Array.isArray(json.messages)) {
            const deletedSet = loadDeletedMsgIds(conversationId);
            const activeServerMsgs: Message[] = json.messages.filter((m: Message) => !deletedSet.has(m.id));

            updateMessagesState((prev) => {
              const currentDeleted = loadDeletedMsgIds(conversationId);

              // Filter only explicitly deleted messages
              const filteredPrev = prev.filter((m) => !currentDeleted.has(m.id));
              const prevMap = new Map<string, Message>(
                filteredPrev.map((m) => [m.id, m])
              );
              let hasChanged = filteredPrev.length !== prev.length;

              activeServerMsgs.forEach((srvMsg: Message) => {
                if (currentDeleted.has(srvMsg.id)) return;
                const existing = prevMap.get(srvMsg.id);
                if (existing) {
                  if (Boolean(existing.is_read) !== Boolean(srvMsg.is_read)) {
                    prevMap.set(srvMsg.id, { ...existing, is_read: Boolean(srvMsg.is_read) });
                    hasChanged = true;
                  }
                  return;
                }

                // Check if an optimistic or earlier message matches by content & sender
                const matchingEntry = Array.from(prevMap.values()).find(
                  (m) =>
                    m.sender_id === srvMsg.sender_id &&
                    m.content === srvMsg.content &&
                    Math.abs(new Date(m.created_at || 0).getTime() - new Date(srvMsg.created_at || 0).getTime()) < 45000
                );

                if (matchingEntry) {
                  prevMap.delete(matchingEntry.id);
                  prevMap.set(srvMsg.id, { ...matchingEntry, ...srvMsg });
                  hasChanged = true;
                } else {
                  prevMap.set(srvMsg.id, srvMsg);
                  hasChanged = true;
                }
              });

              if (!hasChanged && prev.length === prevMap.size) return prev;
              return Array.from(prevMap.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        })
        .catch(() => {});
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, currentUserId, scrollToBottom, updateMessagesState]);

  const sendMessage = async (
    content: string,
    senderProfile?: Profile,
    receiverId?: string,
    receiverProfile?: Profile
  ): Promise<boolean> => {
    const trimmed = content.trim();
    if (!trimmed || !conversationId || !currentUserId) return false;

    // Rapid double-send duplicate guard (< 1000ms identical content)
    if (
      lastSentContentRef.current &&
      lastSentContentRef.current.content === trimmed &&
      Date.now() - lastSentContentRef.current.time < 1000
    ) {
      return false;
    }
    lastSentContentRef.current = { content: trimmed, time: Date.now() };

    setSending(true);
    setError(null);

    let processedContent = content.trim();

    // Auto-convert any inline base64 media to compact server media URLs if passed directly
    if (processedContent.includes('data:image') || processedContent.includes('data:audio')) {
      try {
        if (processedContent.startsWith('[IMAGE:data:image')) {
          const inside = processedContent.slice(7, -1);
          const base64Idx = inside.indexOf(';base64,');
          if (base64Idx !== -1) {
            const nextColon = inside.indexOf(':', base64Idx);
            const dataUrl = nextColon !== -1 ? inside.slice(0, nextColon) : inside;
            const caption = nextColon !== -1 ? inside.slice(nextColon + 1) : '';
            const uploadedUrl = await uploadMediaToServer(dataUrl, { mediaType: 'image' });
            if (uploadedUrl) {
              processedContent = caption ? `[IMAGE:${uploadedUrl}:${caption}]` : `[IMAGE:${uploadedUrl}]`;
            }
          }
        } else if (processedContent.startsWith('[VOICE:')) {
          const tokens = processedContent.slice(7, -1);
          const firstColon = tokens.indexOf(':');
          if (firstColon !== -1) {
            const dur = tokens.slice(0, firstColon);
            const audioData = tokens.slice(firstColon + 1);
            if (audioData.startsWith('data:audio')) {
              const uploadedUrl = await uploadMediaToServer(audioData, { mediaType: 'audio' });
              if (uploadedUrl) {
                processedContent = `[VOICE:${dur}:${uploadedUrl}]`;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Fallback processing media payload:', err);
      }
    }

    const nowIso = new Date().toISOString();
    const tempId = generateUUID();

    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: processedContent,
      created_at: nowIso,
      updated_at: nowIso,
      sender: senderProfile,
      is_read: false,
    };

    // 1. Optimistically display in UI immediately
    updateMessagesState((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(true), 30);

    try {
      const supabase = getSupabase();

      // 2. Broadcast via backend relay & enforce server-side mutual follow
      const relayRes = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: optimisticMessage,
          conversationId,
          receiverId,
          recipientId: receiverId,
          senderProfile,
          receiverProfile,
        }),
      }).catch(() => null);

      if (relayRes && relayRes.status === 403) {
        const errorData = await relayRes.json().catch(() => ({}));
        // Remove optimistic message because mutual follow is required
        updateMessagesState((prev) => prev.filter((m) => m.id !== tempId));
        setError(errorData.error || 'Follow each other to start messaging.');
        return false;
      }

      // 3. Ensure conversation row exists to satisfy foreign key constraint & persist to Supabase Database
      if (conversationId) {
        try {
          await supabase
            .from('conversations')
            .upsert(
              { id: conversationId, type: 'direct', updated_at: nowIso },
              { onConflict: 'id' }
            );
        } catch (e) {
          // ignore
        }
      }

      const { data: savedMsg, error: sendError } = await supabase
        .from('messages')
        .insert({
          id: tempId,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: processedContent,
          created_at: nowIso,
        })
        .select()
        .single();

      if (sendError) {
        console.warn('Note saving message to remote DB:', sendError.message);
      } else if (savedMsg) {
        updateMessagesState((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, ...savedMsg, sender: senderProfile } : m))
        );
      }

      // 4. Update conversation timestamp
      supabase
        .from('conversations')
        .update({ updated_at: nowIso })
        .eq('id', conversationId)
        .then(() => {});

      return true;
    } catch (err: any) {
      console.warn('Failed to commit message to remote database:', err.message);
      return true; // Persisted locally
    } finally {
      setSending(false);
    }
  };

  // Delete a single message for EVERYONE (both sides)
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!messageId) return false;
    const supabase = getSupabase();

    try {
      // 1. Record in persistent tombstone set
      recordDeletedMsgId(conversationId, messageId);

      // 2. Instantly remove from local state and cache
      updateMessagesState((prev) => prev.filter((m) => m.id !== messageId));

      // 3. Broadcast to the other user via Realtime channel
      if (channelRef.current) {
        channelRef.current
          .send({
            type: 'broadcast',
            event: 'message_deleted',
            payload: { conversationId, messageId },
          })
          .catch(() => {});
      }

      // 4. Sync deletion with backend relay
      fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messageId }),
      }).catch(() => {});

      // 5. Delete from Supabase Database for everyone
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.warn('Database notice deleting message:', error.message);
      }

      return true;
    } catch (err: any) {
      console.error('Error in deleteMessage:', err.message);
      return false;
    }
  };

  // Clear all messages in the active conversation for EVERYONE (both sides)
  const clearAllMessages = async (): Promise<boolean> => {
    if (!conversationId) return false;
    const supabase = getSupabase();

    try {
      // 1. Record all current messages into deleted IDs
      const currentIds = messages.map((m) => m.id);
      recordMultipleDeletedMsgIds(conversationId, currentIds);

      // 2. Clear local state and cache
      updateMessagesState([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(getLocalMsgCacheKey(conversationId));
      }

      // 3. Broadcast clear to the other user via Realtime channel
      if (channelRef.current) {
        channelRef.current
          .send({
            type: 'broadcast',
            event: 'messages_cleared',
            payload: { conversationId },
          })
          .catch(() => {});
      }

      // 4. Call backend clear endpoint
      fetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {});

      // 5. Delete all from Supabase for this conversation
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (error) {
        console.warn('Database error clearing messages:', error.message);
      }

      return true;
    } catch (err: any) {
      console.error('Error in clearAllMessages:', err.message);
      return false;
    }
  };

  return {
    messages,
    loading,
    sending,
    error,
    messagesEndRef,
    sendMessage,
    deleteMessage,
    clearAllMessages,
    fetchMessages,
    scrollToBottom,
    markMessagesAsRead,
  };
}
