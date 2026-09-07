import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { Call, Profile } from '@/src/types';

export interface CallHistoryItem extends Call {
  peer: Profile;
  direction: 'incoming' | 'outgoing';
  isMissed: boolean;
  durationFormatted?: string;
}

function getLocalHistoryCacheKey(userId?: string) {
  return `liveconnect_call_history_${userId || 'anon'}`;
}

export function cleanAndDeduplicateCallHistory(calls: CallHistoryItem[]): CallHistoryItem[] {
  if (!Array.isArray(calls) || calls.length === 0) return [];
  const deduplicated: CallHistoryItem[] = [];
  const seenIds = new Set<string>();

  const sorted = [...calls].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  for (const c of sorted) {
    if (!c || !c.id) continue;

    // 1. Exact ID match
    let existingIdx = deduplicated.findIndex((p) => p.id === c.id);

    // 2. Proximity match for same call session (within 15 seconds between same two peers)
    if (existingIdx === -1) {
      existingIdx = deduplicated.findIndex((p) => {
        const samePeers =
          (p.caller_id === c.caller_id && p.callee_id === c.callee_id) ||
          (p.caller_id === c.callee_id && p.callee_id === c.caller_id);
        if (!samePeers) return false;
        const timeDiff = Math.abs(
          new Date(p.created_at || 0).getTime() - new Date(c.created_at || 0).getTime()
        );
        return timeDiff < 15000;
      });
    }

    if (existingIdx >= 0) {
      const prev = deduplicated[existingIdx];
      deduplicated[existingIdx] = {
        ...prev,
        ...c,
        peer: c.peer || prev.peer,
        durationFormatted: c.durationFormatted || prev.durationFormatted,
      };
      continue;
    }

    if (seenIds.has(c.id)) continue;
    seenIds.add(c.id);
    deduplicated.push(c);
  }

  return deduplicated;
}

export function loadLocalCallHistory(userId?: string): CallHistoryItem[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(getLocalHistoryCacheKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as CallHistoryItem[];
      return cleanAndDeduplicateCallHistory(parsed);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

export function saveLocalCallHistory(userId: string | undefined, history: CallHistoryItem[]) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const clean = cleanAndDeduplicateCallHistory(history);
    localStorage.setItem(getLocalHistoryCacheKey(userId), JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('liveconnect_call_history_updated', { detail: { userId } }));
  } catch (e) {
    // ignore
  }
}

export function recordCallInHistory(userId: string | undefined, callItem: CallHistoryItem) {
  if (!userId || !callItem || !callItem.id) return;
  const current = loadLocalCallHistory(userId);
  const existingIdx = current.findIndex(
    (c) =>
      c.id === callItem.id ||
      ((c.caller_id === callItem.caller_id && c.callee_id === callItem.callee_id) &&
        Math.abs(new Date(c.created_at || 0).getTime() - new Date(callItem.created_at || 0).getTime()) < 15000)
  );
  let updated: CallHistoryItem[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...callItem };
  } else {
    updated = [callItem, ...current];
  }
  // Keep max 100 entries
  if (updated.length > 100) {
    updated = updated.slice(0, 100);
  }
  saveLocalCallHistory(userId, updated);
}

export function updateCallInHistory(
  userId: string | undefined,
  callId: string,
  updates: Partial<CallHistoryItem>
) {
  if (!userId || !callId) return;
  const current = loadLocalCallHistory(userId);
  const existingIdx = current.findIndex((c) => c.id === callId);
  if (existingIdx >= 0) {
    const updated = [...current];
    const item = { ...updated[existingIdx], ...updates };

    // Recalculate duration formatting if applicable
    if (item.answered_at && item.ended_at) {
      const start = new Date(item.answered_at).getTime();
      const end = new Date(item.ended_at).getTime();
      const seconds = Math.max(0, Math.floor((end - start) / 1000));
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      item.durationFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } else if (item.status === 'rejected') {
      item.durationFormatted = 'Declined';
    } else if (item.status === 'cancelled') {
      item.durationFormatted = 'Cancelled';
    } else if (item.status === 'missed') {
      item.durationFormatted = 'Missed';
    } else if (item.status === 'calling' || item.status === 'ringing') {
      item.durationFormatted = 'Ringing...';
    } else if (item.status === 'accepted' || item.status === 'connected') {
      item.durationFormatted = 'Connected';
    }

    updated[existingIdx] = item;
    saveLocalCallHistory(userId, updated);
  }
}

export function useCallHistory(currentUserId?: string) {
  const [history, setHistory] = useState<CallHistoryItem[]>(() =>
    loadLocalCallHistory(currentUserId)
  );
  const [loading, setLoading] = useState<boolean>(
    () => loadLocalCallHistory(currentUserId).length === 0
  );
  const [missedCount, setMissedCount] = useState<number>(0);

  // Read last viewed call history timestamp from local storage
  const getLastViewedTimestamp = useCallback(() => {
    if (typeof window === 'undefined' || !currentUserId) return 0;
    const stored = localStorage.getItem(`liveconnect_calls_last_viewed_${currentUserId}`);
    return stored ? parseInt(stored, 10) : 0;
  }, [currentUserId]);

  const markHistoryAsViewed = useCallback(() => {
    if (typeof window === 'undefined' || !currentUserId) return;
    localStorage.setItem(`liveconnect_calls_last_viewed_${currentUserId}`, Date.now().toString());
    setMissedCount(0);
  }, [currentUserId]);

  const formatRawCall = useCallback(
    (rawCall: any, lastViewed: number): { item: CallHistoryItem; isNewMissed: boolean } => {
      const isOutgoing = rawCall.caller_id === currentUserId;
      const isMissed =
        !isOutgoing &&
        (rawCall.status === 'missed' ||
          rawCall.status === 'rejected' ||
          (!rawCall.answered_at && ['ended', 'cancelled', 'missed', 'rejected'].includes(rawCall.status)));

      const callCreatedAt = new Date(rawCall.created_at || Date.now()).getTime();
      const isNewMissed = isMissed && callCreatedAt > lastViewed;

      let durationFormatted = '';
      if (rawCall.answered_at && rawCall.ended_at) {
        const start = new Date(rawCall.answered_at).getTime();
        const end = new Date(rawCall.ended_at).getTime();
        const seconds = Math.max(0, Math.floor((end - start) / 1000));
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        durationFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      } else if (rawCall.status === 'connected' || rawCall.status === 'accepted') {
        durationFormatted = 'In progress';
      } else if (isMissed || rawCall.status === 'missed') {
        durationFormatted = 'Missed';
      } else if (rawCall.status === 'rejected') {
        durationFormatted = 'Declined';
      } else if (rawCall.status === 'cancelled') {
        durationFormatted = 'Cancelled';
      } else if (rawCall.status === 'calling' || rawCall.status === 'ringing') {
        durationFormatted = 'Ringing...';
      }

      const peerId = isOutgoing ? rawCall.callee_id : rawCall.caller_id;
      const rawPeer = rawCall.peer || (isOutgoing ? rawCall.callee : rawCall.caller);

      const peer: Profile = {
        id: peerId,
        username: rawPeer?.username || 'user',
        display_name: rawPeer?.display_name || rawPeer?.username || 'Contact',
        avatar_url: rawPeer?.avatar_url || null,
        bio: rawPeer?.bio || null,
        is_online: Boolean(rawPeer?.is_online),
        last_seen: rawPeer?.last_seen || rawCall.created_at,
        created_at: rawPeer?.created_at || rawCall.created_at,
        updated_at: rawPeer?.updated_at || rawCall.created_at,
      };

      const item: CallHistoryItem = {
        ...rawCall,
        peer,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        isMissed,
        durationFormatted,
      };

      return { item, isNewMissed };
    },
    [currentUserId]
  );

  const fetchHistory = useCallback(async () => {
    if (!currentUserId) {
      setHistory([]);
      setMissedCount(0);
      setLoading(false);
      return;
    }

    const lastViewed = getLastViewedTimestamp();
    const localList = loadLocalCallHistory(currentUserId);
    const combinedMap = new Map<string, CallHistoryItem>();

    // 1. Seed with local storage
    localList.forEach((c) => {
      if (c.id) combinedMap.set(c.id, c);
    });

    // 2. Fetch from Server Relay Store
    try {
      const srvRes = await fetch('/api/calls/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (Array.isArray(srvData.calls)) {
          srvData.calls.forEach((c: any) => {
            const { item } = formatRawCall(c, lastViewed);
            combinedMap.set(item.id, item);
          });
        }
      }
    } catch (e) {
      // server relay fallback
    }

    // 3. Fetch from Supabase Table
    try {
      const supabase = getSupabase();
      const { data: dbCalls } = await supabase
        .from('calls')
        .select('*')
        .or(`caller_id.eq.${currentUserId},callee_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (Array.isArray(dbCalls) && dbCalls.length > 0) {
        // Collect peer user IDs needed
        const missingUserIds = new Set<string>();
        dbCalls.forEach((call) => {
          const peerId = call.caller_id === currentUserId ? call.callee_id : call.caller_id;
          if (peerId && !combinedMap.get(call.id)?.peer?.display_name) {
            missingUserIds.add(peerId);
          }
        });

        const profileLookup = new Map<string, Profile>();
        if (missingUserIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', Array.from(missingUserIds));
          if (Array.isArray(profiles)) {
            profiles.forEach((p: Profile) => profileLookup.set(p.id, p));
          }
        }

        dbCalls.forEach((call) => {
          const peerId = call.caller_id === currentUserId ? call.callee_id : call.caller_id;
          const peerProfile = profileLookup.get(peerId);
          const rawWithPeer = {
            ...call,
            peer: peerProfile || combinedMap.get(call.id)?.peer,
          };
          const { item } = formatRawCall(rawWithPeer, lastViewed);
          combinedMap.set(item.id, item);
        });
      }
    } catch (dbErr) {
      // db fallback
    }

    // 4. Sort and calculate missed count
    const sorted = cleanAndDeduplicateCallHistory(Array.from(combinedMap.values()));

    let missed = 0;
    sorted.forEach((item) => {
      const callCreatedAt = new Date(item.created_at || 0).getTime();
      if (item.isMissed && callCreatedAt > lastViewed) {
        missed += 1;
      }
    });

    setHistory(sorted);
    setMissedCount(missed);
    saveLocalCallHistory(currentUserId, sorted);
    setLoading(false);
  }, [currentUserId, formatRawCall, getLastViewedTimestamp]);

  // Delete a single call history record
  const deleteCall = async (callId: string): Promise<boolean> => {
    if (!callId || !currentUserId) return false;
    const supabase = getSupabase();

    try {
      // 1. Instantly remove from local state
      setHistory((prev) => {
        const next = prev.filter((c) => c.id !== callId);
        saveLocalCallHistory(currentUserId, next);
        return next;
      });

      // 2. Delete from Supabase Database
      await supabase.from('calls').delete().eq('id', callId);

      return true;
    } catch (err: any) {
      console.error('Error deleting call log:', err.message);
      return false;
    }
  };

  // Clear all call history records for the current user
  const clearAllHistory = async (): Promise<boolean> => {
    if (!currentUserId) return false;
    const supabase = getSupabase();

    try {
      // 1. Instantly clear local state
      setHistory([]);
      setMissedCount(0);
      saveLocalCallHistory(currentUserId, []);

      // 2. Delete from Supabase Database
      await supabase
        .from('calls')
        .delete()
        .or(`caller_id.eq.${currentUserId},callee_id.eq.${currentUserId}`);

      return true;
    } catch (err: any) {
      console.error('Error clearing all call history:', err.message);
      return false;
    }
  };

  useEffect(() => {
    fetchHistory();

    if (!currentUserId) return;
    const supabase = getSupabase();

    // 1. Listen for local history updates (cross-component & storage events)
    const handleLocalUpdate = () => {
      const local = loadLocalCallHistory(currentUserId);
      setHistory(local);
      const lastViewed = getLastViewedTimestamp();
      let missed = 0;
      local.forEach((item) => {
        const callCreatedAt = new Date(item.created_at || 0).getTime();
        if (item.isMissed && callCreatedAt > lastViewed) {
          missed += 1;
        }
      });
      setMissedCount(missed);
    };

    window.addEventListener('liveconnect_call_history_updated', handleLocalUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === getLocalHistoryCacheKey(currentUserId)) {
        handleLocalUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 2. Subscribe to realtime Postgres changes
    const channel = supabase
      .channel(`call_history:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    // 3. Polling interval to auto-sync unanswered/new calls without user having to reload
    const pollTimer = setInterval(() => {
      fetchHistory();
    }, 3000);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('liveconnect_call_history_updated', handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchHistory, getLastViewedTimestamp]);

  return {
    history,
    loading,
    missedCount,
    refetch: fetchHistory,
    markHistoryAsViewed,
    deleteCall,
    clearAllHistory,
  };
}
