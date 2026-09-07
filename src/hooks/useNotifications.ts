import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { AppNotification, Profile } from '@/src/types';
import { notificationService } from '@/src/lib/notification-service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  return UUID_REGEX.test(val) ? val : null;
}

export function useNotifications(currentUserId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    try {
      // 1. Fetch notifications from Supabase
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Fallback to backend API
        const res = await fetch('/api/notifications/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId }),
        });
        if (res.ok) {
          const apiData = await res.json();
          setNotifications(apiData.notifications || []);
        }
        return;
      }

      const rawNotifs = data || [];
      const actorIds = Array.from(new Set(rawNotifs.map((n) => n.actor_id)));
      let profileMap: Record<string, Profile> = {};

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', actorIds);

        if (profiles) {
          profiles.forEach((p) => {
            profileMap[p.id] = p;
          });
        }
      }

      const populated: AppNotification[] = rawNotifs.map((n: any) => ({
        ...n,
        actor: profileMap[n.actor_id] || {
          id: n.actor_id,
          display_name: 'User',
          username: 'user',
        },
      }));

      setNotifications(populated);
    } catch (err: any) {
      console.warn('Error fetching notifications:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for incoming notifications
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = getSupabase();

    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const newNotif = payload.new as AppNotification;

          // Fetch actor profile
          let actorProfile: Profile | undefined;
          if (newNotif.actor_id) {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newNotif.actor_id)
              .single();
            actorProfile = data as Profile;
          }

          const fullNotif: AppNotification = {
            ...newNotif,
            actor: actorProfile,
          };

          // Trigger browser notification banner & sound
          notificationService.sendNotification({
            title: fullNotif.title || 'LiveConnect Notification',
            body: fullNotif.message || 'You have a new update',
            tag: `notif-${fullNotif.id}`,
          });

          setNotifications((prev) => [fullNotif, ...prev.filter((n) => n.id !== fullNotif.id)]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!currentUserId || !notificationId) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );

      const supabase = getSupabase();

      try {
        fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, notificationId }),
        }).catch(() => {});

        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId);
      } catch (err: any) {
        console.warn('Error marking notification read:', err.message);
      }
    },
    [currentUserId]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    const supabase = getSupabase();

    try {
      fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      }).catch(() => {});

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUserId);
    } catch (err: any) {
      console.warn('Error marking all notifications read:', err.message);
    }
  }, [currentUserId]);

  // Delete a notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!currentUserId || !notificationId) return;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      const supabase = getSupabase();
      try {
        await supabase.from('notifications').delete().eq('id', notificationId);
      } catch (err: any) {
        console.warn('Error deleting notification:', err.message);
      }
    },
    [currentUserId]
  );

  // Helper to send a notification (e.g. follow, call, etc.)
  const createNotification = useCallback(
    async (params: {
      userId: string;
      actorId: string;
      type: AppNotification['type'];
      title: string;
      message: string;
      referenceId?: string;
      actorMeta?: Profile;
    }) => {
      const supabase = getSupabase();
      try {
        fetch('/api/notifications/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }).catch(() => {});

        const sanitizedRefId = toUuidOrNull(params.referenceId);
        const insertPayload: Record<string, any> = {
          user_id: params.userId,
          actor_id: params.actorId,
          type: params.type,
          title: params.title,
          message: params.message,
          is_read: false,
        };
        if (sanitizedRefId) {
          insertPayload.reference_id = sanitizedRefId;
        }

        await supabase.from('notifications').insert(insertPayload);
      } catch (err: any) {
        console.warn('Error creating notification:', err.message);
      }
    },
    []
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
  };
}
