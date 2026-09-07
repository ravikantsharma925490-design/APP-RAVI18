import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { Profile } from '@/src/types';

export function usePresence(currentUserId?: string) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, { is_online: boolean; last_seen: string }>>({});
  // Re-evaluation tick every 10 seconds to auto-expire stale heartbeats
  const [, setTick] = useState(0);

  const channelRef = useRef<any>(null);

  // Send offline beacon to server and DB
  const sendOfflineStatus = useCallback((userId: string) => {
    if (!userId) return;
    const now = new Date().toISOString();

    // 1. Send keepalive fetch or sendBeacon
    try {
      const payload = JSON.stringify({ userId });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/presence/offline', blob);
      } else {
        fetch('/api/presence/offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch (e) {}

    // 2. Direct Supabase DB update
    try {
      const supabase = getSupabase();
      supabase
        .from('profiles')
        .update({ is_online: false, last_seen: now })
        .eq('id', userId)
        .then(() => {});
    } catch (e) {}
  }, []);

  // Send online heartbeat to server and DB
  const sendOnlineHeartbeat = useCallback((userId: string) => {
    if (!userId) return;
    const now = new Date().toISOString();

    // 1. Direct Supabase DB update
    try {
      const supabase = getSupabase();
      supabase
        .from('profiles')
        .update({ is_online: true, last_seen: now })
        .eq('id', userId)
        .then(() => {});
    } catch (e) {}

    // 2. Backend sync
    try {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const supabase = getSupabase();

    // 1. Immediately mark self online
    sendOnlineHeartbeat(currentUserId);

    // 2. Set up Supabase Realtime Presence Channel
    const channel = supabase.channel('online-presence', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newOnlineMap: Record<string, { is_online: boolean; last_seen: string }> = {};

        Object.keys(state).forEach((userId) => {
          newOnlineMap[userId] = {
            is_online: true,
            last_seen: new Date().toISOString(),
          };
        });

        // Always ensure current user is marked online in their own view
        if (currentUserId) {
          newOnlineMap[currentUserId] = {
            is_online: true,
            last_seen: new Date().toISOString(),
          };
        }

        setOnlineUsers(newOnlineMap);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key) {
          setOnlineUsers((prev) => ({
            ...prev,
            [key]: { is_online: true, last_seen: new Date().toISOString() },
          }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key) {
          setOnlineUsers((prev) => ({
            ...prev,
            [key]: { is_online: false, last_seen: new Date().toISOString() },
          }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    // 3. Heartbeat interval every 20 seconds
    const heartbeatInterval = setInterval(() => {
      sendOnlineHeartbeat(currentUserId);
      if (channelRef.current) {
        channelRef.current.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }, 20000);

    // 4. Tick timer every 10 seconds to auto-expire stale heartbeats
    const tickInterval = setInterval(() => {
      setTick((t) => (t + 1) % 10000);
    }, 10000);

    // 5. Browser Lifecycle events (beforeunload, pagehide, visibilitychange)
    const handleBeforeUnload = () => {
      sendOfflineStatus(currentUserId);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendOnlineHeartbeat(currentUserId);
        if (channelRef.current) {
          channelRef.current.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          }).catch(() => {});
        }
      } else if (document.visibilityState === 'hidden') {
        // Update last seen
        sendOnlineHeartbeat(currentUserId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(tickInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {});
        supabase.removeChannel(channelRef.current);
      }
      sendOfflineStatus(currentUserId);
    };
  }, [currentUserId, sendOnlineHeartbeat, sendOfflineStatus]);

  /**
   * Accurate check if a user is online:
   * 1. Current user themselves -> ALWAYS true if logged in and active
   * 2. Realtime presence map entry exists -> Use presence state (true/false)
   * 3. Database fallback -> ONLY online if `is_online === true` AND `last_seen` was within the last 50 seconds
   * 4. Everything else -> Strictly FALSE (Offline)
   */
  const isUserOnline = useCallback(
    (profile?: Profile | null): boolean => {
      if (!profile?.id) return false;

      // 1. Current user is active
      if (currentUserId && profile.id === currentUserId) {
        return true;
      }

      // 2. Realtime presence map check
      const presenceData = onlineUsers[profile.id];
      if (presenceData !== undefined) {
        return Boolean(presenceData.is_online);
      }

      // 3. Strict DB freshness check (Heartbeat interval is 20s; allow max 50s window)
      if (profile.is_online && profile.last_seen) {
        const lastSeenMs = new Date(profile.last_seen).getTime();
        const now = Date.now();
        if (!isNaN(lastSeenMs) && now - lastSeenMs < 50 * 1000) {
          return true;
        }
      }

      return false;
    },
    [currentUserId, onlineUsers]
  );

  const getUserLastSeen = useCallback(
    (profile?: Profile | null): string => {
      if (!profile?.id) return '';
      return onlineUsers[profile.id]?.last_seen || profile.last_seen || profile.updated_at || '';
    },
    [onlineUsers]
  );

  return {
    onlineUsers,
    isUserOnline,
    getUserLastSeen,
  };
}
