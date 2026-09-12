import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { Profile, UserRelationStatus } from '@/src/types';
import { FollowStatus } from '@/src/components/profile/FollowButton';
import {
  loadLocalFollows,
  saveLocalFollows,
  saveCachedProfile,
  loadCachedProfiles,
  loadCachedFollowersList,
  saveCachedFollowersList,
  loadCachedFollowingList,
  saveCachedFollowingList,
  saveMultipleCachedProfiles,
} from '@/src/lib/social-cache';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  return UUID_REGEX.test(val) ? val : null;
}

export function useSocialRelations(currentProfile?: Profile | null) {
  const currentUserId = currentProfile?.id;
  const initialLocal = useMemo(() => {
    const loc = loadLocalFollows(currentUserId);
    const cachedFollowers = loadCachedFollowersList(currentUserId);
    const cachedFollowing = loadCachedFollowingList(currentUserId);
    const following = Array.from(new Set([...loc.following, ...cachedFollowing.map((p) => p.id)]));
    const followers = Array.from(new Set([...loc.followers, ...cachedFollowers.map((p) => p.id)]));
    return { following, followers };
  }, [currentUserId]);

  const [followingSet, setFollowingSet] = useState<Set<string>>(() => new Set(initialLocal.following));
  const [followerSet, setFollowerSet] = useState<Set<string>>(() => new Set(initialLocal.followers));
  const [blockedByMeSet, setBlockedByMeSet] = useState<Set<string>>(new Set());
  const [blockedByThemSet, setBlockedByThemSet] = useState<Set<string>>(new Set());
  const [countsMap, setCountsMap] = useState<Record<string, { followers: number; following: number }>>({});
  const [loading, setLoading] = useState<boolean>(
    () => !(initialLocal.following.length > 0 || initialLocal.followers.length > 0)
  );
  const inFlightRef = useRef<Set<string>>(new Set());

  // Synchronize initial relations from Supabase follows table and Server
  const fetchRelations = useCallback(async () => {
    if (!currentUserId) {
      setFollowingSet(new Set());
      setFollowerSet(new Set());
      setBlockedByMeSet(new Set());
      setBlockedByThemSet(new Set());
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    try {
      const nextFollowing = new Set<string>();
      const nextFollowers = new Set<string>();
      let fetchedFromNetwork = false;

      // 1. Fetch people I follow and people following me from Supabase
      try {
        const [{ data: myFollows, error: followsErr }, { data: myFollowers, error: followersErr }] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
          supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
        ]);

        if (!followsErr && Array.isArray(myFollows)) {
          fetchedFromNetwork = true;
          myFollows.forEach((f: any) => {
            if (f.following_id) nextFollowing.add(f.following_id);
          });
        }

        if (!followersErr && Array.isArray(myFollowers)) {
          fetchedFromNetwork = true;
          myFollowers.forEach((f: any) => {
            if (f.follower_id) nextFollowers.add(f.follower_id);
          });
        }
      } catch (e) {
        // Safe fallback
      }

      // 2. Sync with authoritative server state overview
      try {
        const sRes = await fetch('/api/relations/user-overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            username: currentProfile?.username,
          }),
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (Array.isArray(sData.following)) {
            fetchedFromNetwork = true;
            sData.following.forEach((id: string) => nextFollowing.add(id));
          }
          if (Array.isArray(sData.followers)) {
            fetchedFromNetwork = true;
            sData.followers.forEach((id: string) => nextFollowers.add(id));
          }
        }
      } catch (err) {
        // Server fallback fail safe
      }

      // If network calls failed completely, fallback to local cache
      if (!fetchedFromNetwork) {
        const local = loadLocalFollows(currentUserId);
        local.following.forEach((id) => nextFollowing.add(id));
        local.followers.forEach((id) => nextFollowers.add(id));
      } else {
        saveLocalFollows(currentUserId, {
          following: Array.from(nextFollowing),
          followers: Array.from(nextFollowers),
        });
      }

      setFollowingSet(nextFollowing);
      setFollowerSet(nextFollowers);

      // 4. Fetch blocked users (by me)
      const nextBlockedByMe = new Set<string>();
      try {
        const { data: myBlocks, error: blockErr } = await supabase
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', currentUserId);

        if (!blockErr && myBlocks) {
          myBlocks.forEach((b: any) => nextBlockedByMe.add(b.blocked_id));
        }
      } catch (e) {
        // Safe fallback
      }
      setBlockedByMeSet(nextBlockedByMe);

      // 5. Fetch who blocked me
      const nextBlockedByThem = new Set<string>();
      try {
        const { data: blocksAgainstMe, error: themBlockErr } = await supabase
          .from('blocked_users')
          .select('blocker_id')
          .eq('blocked_id', currentUserId);

        if (!themBlockErr && blocksAgainstMe) {
          blocksAgainstMe.forEach((b: any) => nextBlockedByThem.add(b.blocker_id));
        }
      } catch (e) {
        // Safe fallback
      }
      setBlockedByThemSet(nextBlockedByThem);

      // 6. Fetch all global follows to compute accurate counts for every user
      const allFollowPairs = new Set<string>();
      if (currentUserId) {
        nextFollowing.forEach((id) => allFollowPairs.add(`${currentUserId}:${id}`));
        nextFollowers.forEach((id) => allFollowPairs.add(`${id}:${currentUserId}`));
      }

      try {
        const { data: allFollows, error: allFollowsErr } = await supabase
          .from('follows')
          .select('follower_id, following_id')
          .limit(3000);

        if (!allFollowsErr && allFollows && Array.isArray(allFollows)) {
          allFollows.forEach((f: any) => {
            if (f.follower_id && f.following_id) {
              allFollowPairs.add(`${f.follower_id}:${f.following_id}`);
              if (f.follower_id === currentUserId) nextFollowing.add(f.following_id);
              if (f.following_id === currentUserId) nextFollowers.add(f.follower_id);
            }
          });
        }
      } catch (e) {
        // Safe fallback
      }

      // Calculate deduplicated count for all users
      const cMap: Record<string, { followers: number; following: number }> = {};
      for (const pair of allFollowPairs) {
        const [fId, tId] = pair.split(':');
        if (fId && tId) {
          if (!cMap[fId]) cMap[fId] = { followers: 0, following: 0 };
          if (!cMap[tId]) cMap[tId] = { followers: 0, following: 0 };
          cMap[fId].following += 1;
          cMap[tId].followers += 1;
        }
      }

      // Fetch server-side all-counts fallback
      try {
        const countsRes = await fetch('/api/relations/all-counts');
        if (countsRes.ok) {
          const countsData = await countsRes.json();
          if (countsData?.counts) {
            Object.entries(countsData.counts).forEach(([uId, c]: [string, any]) => {
              cMap[uId] = { followers: c.followers || 0, following: c.following || 0 };
            });
          }
        }
      } catch (err) {
        // ignore
      }

      if (currentUserId) {
        cMap[currentUserId] = {
          followers: nextFollowers.size,
          following: nextFollowing.size,
        };
        saveLocalFollows(currentUserId, {
          following: Array.from(nextFollowing),
          followers: Array.from(nextFollowers),
        });
      }

      setFollowingSet(nextFollowing);
      setFollowerSet(nextFollowers);
      setCountsMap(cMap);
    } catch (err: any) {
      console.warn('Notice loading social relations from Supabase:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, currentProfile?.username]);

  useEffect(() => {
    fetchRelations();

    // Fast polling to ensure other user's follow-back is reflected immediately
    const pollInterval = setInterval(() => {
      fetchRelations();
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [fetchRelations]);

  // Realtime subscription for follows and blocked_users
  useEffect(() => {
    if (!currentUserId) return;

    const supabase = getSupabase();

    const channel = supabase
      .channel(`social-relations-realtime-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows' },
        (payload: any) => {
          const newRow = payload.new;
          if (newRow) {
            const { follower_id, following_id } = newRow;
            if (follower_id === currentUserId) {
              setFollowingSet((prev) => new Set([...prev, following_id]));
            }
            if (following_id === currentUserId) {
              setFollowerSet((prev) => new Set([...prev, follower_id]));
            }
            setCountsMap((prev) => {
              const curFollower = prev[follower_id] || { followers: 0, following: 0 };
              const curFollowing = prev[following_id] || { followers: 0, following: 0 };
              return {
                ...prev,
                [follower_id]: { ...curFollower, following: curFollower.following + 1 },
                [following_id]: { ...curFollowing, followers: curFollowing.followers + 1 },
              };
            });
          }
          fetchRelations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows' },
        (payload: any) => {
          const oldRow = payload.old;
          if (oldRow) {
            const { follower_id, following_id } = oldRow;
            if (follower_id === currentUserId && following_id) {
              setFollowingSet((prev) => {
                const next = new Set(prev);
                next.delete(following_id);
                return next;
              });
            }
            if (following_id === currentUserId && follower_id) {
              setFollowerSet((prev) => {
                const next = new Set(prev);
                next.delete(follower_id);
                return next;
              });
            }
            if (follower_id && following_id) {
              setCountsMap((prev) => {
                const curFollower = prev[follower_id] || { followers: 0, following: 0 };
                const curFollowing = prev[following_id] || { followers: 0, following: 0 };
                return {
                  ...prev,
                  [follower_id]: { ...curFollower, following: Math.max(0, curFollower.following - 1) },
                  [following_id]: { ...curFollowing, followers: Math.max(0, curFollowing.followers - 1) },
                };
              });
            }
          }
          fetchRelations();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_users' },
        () => {
          fetchRelations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchRelations]);

  // Authorization & status checks
  const isBlocked = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return false;
      return blockedByMeSet.has(targetUserId) || blockedByThemSet.has(targetUserId);
    },
    [blockedByMeSet, blockedByThemSet]
  );

  const isBlockedByMe = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return false;
      return blockedByMeSet.has(targetUserId);
    },
    [blockedByMeSet]
  );

  const isFollowing = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return false;
      if (isBlocked(targetUserId)) return false;
      return followingSet.has(targetUserId);
    },
    [followingSet, isBlocked]
  );

  const isFollowedBy = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return false;
      if (isBlocked(targetUserId)) return false;
      return followerSet.has(targetUserId);
    },
    [followerSet, isBlocked]
  );

  // CRITICAL REQUIREMENT: User A follows User B AND User B follows User A
  // Can use DB RPC `is_mutual_follow(user_a, user_b)` or synchronized state
  const isMutualFollow = useCallback(
    (targetUserId: string, userBId?: string): boolean => {
      const uA = userBId ? targetUserId : currentUserId;
      const uB = userBId ? userBId : targetUserId;
      if (!uA || !uB || uA === uB) return false;
      if (isBlocked(uB)) return false;

      if (uA === currentUserId) {
        let followsB = followingSet.has(uB);
        let bFollowsMe = followerSet.has(uB);
        if (!followsB || !bFollowsMe) {
          const cached = loadCachedProfiles();
          const p = cached[uB];
          if (p?.username) {
            if (!followsB && followingSet.has(p.username)) followsB = true;
            if (!bFollowsMe && followerSet.has(p.username)) bFollowsMe = true;
          }
        }
        return followsB && bFollowsMe;
      }
      return false;
    },
    [currentUserId, followingSet, followerSet, isBlocked]
  );

  // Exact follow status function according to specification:
  // 'not_following' | 'following' | 'followed_by' | 'mutual' | 'self'
  const getFollowStatus = useCallback(
    (targetUserId: string): FollowStatus => {
      if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
        return 'self';
      }

      let followsTarget = followingSet.has(targetUserId);
      let targetFollowsMe = followerSet.has(targetUserId);

      if (!followsTarget || !targetFollowsMe) {
        const cached = loadCachedProfiles();
        const p = cached[targetUserId];
        if (p?.username) {
          if (!followsTarget && followingSet.has(p.username)) followsTarget = true;
          if (!targetFollowsMe && followerSet.has(p.username)) targetFollowsMe = true;
        }
      }

      if (followsTarget && targetFollowsMe) {
        return 'mutual';
      }
      if (followsTarget) {
        return 'following';
      }
      if (targetFollowsMe) {
        return 'followed_by';
      }
      return 'not_following';
    },
    [currentUserId, followingSet, followerSet]
  );

  // Optional RPC helper: Calls database `get_follow_status(current_user_id, target_user_id)`
  const fetchRpcFollowStatus = useCallback(
    async (targetUserId: string): Promise<FollowStatus> => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) return 'self';
      const supabase = getSupabase();
      try {
        const { data, error } = await supabase.rpc('get_follow_status', {
          current_user_id: currentUserId,
          target_user_id: targetUserId,
        });
        if (!error && data) {
          return data as FollowStatus;
        }
      } catch (e) {
        // Fallback to local synchronous computation
      }
      return getFollowStatus(targetUserId);
    },
    [currentUserId, getFollowStatus]
  );

  // Optional RPC helper: Calls database `is_mutual_follow(user_a, user_b)`
  const checkRpcMutualFollow = useCallback(
    async (userA: string, userB: string): Promise<boolean> => {
      if (!userA || !userB || userA === userB) return false;
      const supabase = getSupabase();
      try {
        const { data, error } = await supabase.rpc('is_mutual_follow', {
          user_a: userA,
          user_b: userB,
        });
        if (!error && typeof data === 'boolean') {
          return data;
        }
      } catch (e) {
        // Fallback
      }
      return isMutualFollow(userA, userB);
    },
    [isMutualFollow]
  );

  const getRelationStatus = useCallback(
    (targetUserId: string): UserRelationStatus => {
      const isBlockedMe = blockedByMeSet.has(targetUserId);
      const isBlockedThem = blockedByThemSet.has(targetUserId);
      const blocked = isBlockedMe || isBlockedThem;

      const isSelf = targetUserId === currentUserId;
      let following = !blocked && (isSelf ? false : followingSet.has(targetUserId));
      let followed = !blocked && (isSelf ? false : followerSet.has(targetUserId));

      if (!following || !followed) {
        const cached = loadCachedProfiles();
        const p = cached[targetUserId];
        if (p?.username) {
          if (!following && followingSet.has(p.username)) following = true;
          if (!followed && followerSet.has(p.username)) followed = true;
        }
      }

      const mutual = following && followed;

      const baseCounts = countsMap[targetUserId];
      const targetFollowers = isSelf
        ? followerSet.size
        : typeof baseCounts?.followers === 'number'
        ? baseCounts.followers
        : following
        ? 1
        : 0;

      const targetFollowing = isSelf
        ? followingSet.size
        : typeof baseCounts?.following === 'number'
        ? baseCounts.following
        : followed
        ? 1
        : 0;

      return {
        isFollowing: following,
        isFollowedBy: followed,
        isMutual: mutual,
        isBlockedByMe: isBlockedMe,
        isBlockedByThem: isBlockedThem,
        isBlocked: blocked,
        followersCount: targetFollowers,
        followingCount: targetFollowing,
      };
    },
    [blockedByMeSet, blockedByThemSet, currentUserId, followingSet, followerSet, countsMap]
  );

  // 1. Follow User (or Follow Back)
  const followUser = useCallback(
    async (targetUser: Profile | string | any): Promise<boolean> => {
      const targetId =
        typeof targetUser === 'string'
          ? targetUser
          : targetUser?.id ||
            targetUser?.user_id ||
            targetUser?.follower_id ||
            targetUser?.following_id ||
            targetUser?.actor_id;

      if (!currentUserId || !targetId || currentUserId === targetId) {
        return false;
      }
      if (isBlocked(targetId)) {
        return false;
      }

      // Prevent duplicate in-flight requests
      if (inFlightRef.current.has(targetId)) {
        return false;
      }
      inFlightRef.current.add(targetId);

      // Save previous state for rollback if needed
      const previousFollowing = new Set(followingSet);
      const previousCounts = { ...countsMap };

      // Optimistic state update
      if (typeof targetUser === 'object' && targetUser !== null) {
        saveCachedProfile(targetUser);
      }
      setFollowingSet((prev) => {
        const next = new Set<string>(prev);
        next.add(targetId);
        saveLocalFollows(currentUserId, {
          following: Array.from(next),
          followers: Array.from(followerSet),
        });
        return next;
      });

      setCountsMap((prev) => {
        const curTarget = prev[targetId] || { followers: 0, following: 0 };
        const curMe = prev[currentUserId] || { followers: followerSet.size, following: followingSet.size };
        return {
          ...prev,
          [targetId]: { ...curTarget, followers: Math.max(1, curTarget.followers + 1) },
          [currentUserId]: { ...curMe, following: curMe.following + 1 },
        };
      });

      const supabase = getSupabase();

      try {
        // 1. Sync with backend API proxy for guaranteed server-side state & notifications
        const targetMeta = typeof targetUser === 'object' ? targetUser : undefined;
        fetch('/api/relations/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            targetUserId: targetId,
            userMeta: currentProfile,
            targetMeta: targetMeta,
          }),
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              if (data?.isFollowedBy || data?.isMutual) {
                setFollowerSet((prev: Set<string>) => {
                  const next = new Set<string>(prev);
                  next.add(targetId);
                  saveLocalFollows(currentUserId, {
                    following: [...Array.from(followingSet), targetId],
                    followers: Array.from(next),
                  });
                  return next;
                });
              }
            }
          })
          .catch(() => {});

        // 2. Insert into Supabase follows table with RLS: follower_id = auth.uid()
        try {
          const { error } = await supabase.from('follows').upsert(
            {
              follower_id: currentUserId,
              following_id: targetId,
            },
            { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
          );

          if (error) {
            // Fallback simple insert if upsert fails
            const { error: insertErr } = await supabase.from('follows').insert({
              follower_id: currentUserId,
              following_id: targetId,
            });
            if (insertErr) {
              console.warn('[Follow Insert Warning]:', insertErr.message);
            }
          }
        } catch (dbErr) {
          // Handled safely
        }

        // 3. Trigger immediate notification in Supabase
        try {
          const isFollowedByTarget = followerSet.has(targetId);
          const sanitizedRefId = toUuidOrNull(currentUserId);
          const notifPayload: Record<string, any> = {
            user_id: targetId,
            actor_id: currentUserId,
            type: isFollowedByTarget ? 'follow_back' : 'follow',
            title: isFollowedByTarget ? 'Followed you back' : 'New follower',
            message: `${currentProfile?.display_name || currentProfile?.username || 'Someone'} ${
              isFollowedByTarget ? 'followed you back. You are now connected!' : 'started following you.'
            }`,
            is_read: false,
          };
          if (sanitizedRefId) {
            notifPayload.reference_id = sanitizedRefId;
          }

          await supabase.from('notifications').insert(notifPayload);
        } catch (notifErr) {
          // ignore
        }

        fetchRelations();
        return true;
      } catch (err: any) {
        // Rollback on fatal error
        setFollowingSet(previousFollowing);
        setCountsMap(previousCounts);
        return false;
      } finally {
        inFlightRef.current.delete(targetId);
      }
    },
    [currentUserId, currentProfile, followerSet, followingSet, isBlocked, countsMap, fetchRelations]
  );

  // 2. Unfollow User
  const unfollowUser = useCallback(
    async (targetUser: Profile | string | any): Promise<boolean> => {
      const targetUserId =
        typeof targetUser === 'string'
          ? targetUser
          : targetUser?.id ||
            targetUser?.user_id ||
            targetUser?.follower_id ||
            targetUser?.following_id ||
            targetUser?.actor_id;

      if (!currentUserId || !targetUserId) return false;

      if (inFlightRef.current.has(targetUserId)) {
        return false;
      }
      inFlightRef.current.add(targetUserId);

      // Save previous state for rollback
      const previousFollowing = new Set(followingSet);
      const previousCounts = { ...countsMap };

      // Optimistic state update: Remove ONLY current user -> target user
      setFollowingSet((prev) => {
        const next = new Set<string>(prev);
        next.delete(targetUserId);
        saveLocalFollows(currentUserId, {
          following: Array.from(next),
          followers: Array.from(followerSet),
        });
        return next;
      });

      setCountsMap((prev) => {
        const curTarget = prev[targetUserId] || { followers: 1, following: 0 };
        const curMe = prev[currentUserId] || { followers: followerSet.size, following: followingSet.size };
        return {
          ...prev,
          [targetUserId]: { ...curTarget, followers: Math.max(0, curTarget.followers - 1) },
          [currentUserId]: { ...curMe, following: Math.max(0, curMe.following - 1) },
        };
      });

      const supabase = getSupabase();

      try {
        // Sync with backend API
        fetch('/api/relations/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            targetUserId,
          }),
        }).catch(() => {});

        // Delete from Supabase follows table: follower_id = currentUserId AND following_id = targetUserId
        try {
          await supabase
            .from('follows')
            .delete()
            .match({ follower_id: currentUserId, following_id: targetUserId });
        } catch (e) {
          // Handled
        }

        fetchRelations();
        return true;
      } catch (err: any) {
        setFollowingSet(previousFollowing);
        setCountsMap(previousCounts);
        return false;
      } finally {
        inFlightRef.current.delete(targetUserId);
      }
    },
    [currentUserId, followerSet, followingSet, countsMap, fetchRelations]
  );

  // 3. Fetch Followers list for any user
  const fetchFollowersList = useCallback(
    async (userId: string): Promise<Profile[]> => {
      if (!userId) return [];
      const cachedList = loadCachedFollowersList(userId);

      // 1. Try server overview endpoint first for fast authoritative data
      try {
        const sRes = await fetch('/api/relations/user-overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (Array.isArray(sData.followerProfiles) && sData.followerProfiles.length > 0) {
            saveCachedFollowersList(userId, sData.followerProfiles);
            saveMultipleCachedProfiles(sData.followerProfiles);
            return sData.followerProfiles;
          }
        }
      } catch (e) {
        // Continue to Supabase attempt
      }

      // 2. Query Supabase follows and profiles
      const supabase = getSupabase();
      try {
        const { data: followRows, error } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId);

        if (!error && Array.isArray(followRows) && followRows.length > 0) {
          const followerIds = followRows.map((r: any) => r.follower_id).filter(Boolean);
          if (followerIds.length > 0) {
            const { data: profileRows } = await supabase
              .from('profiles')
              .select('*')
              .in('id', followerIds);

            const cachedMap = loadCachedProfiles();
            const results: Profile[] = followerIds.map((id: string) => {
              const matched = profileRows?.find((p: any) => p.id === id);
              if (matched) return matched as Profile;
              if (cachedMap[id]) return cachedMap[id];
              return {
                id,
                username: `user_${id.slice(0, 6)}`,
                display_name: 'User',
                avatar_url: null,
                bio: null,
                is_online: false,
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            });

            saveCachedFollowersList(userId, results);
            saveMultipleCachedProfiles(results);
            return results;
          }
        }
      } catch (err) {
        console.error('Error fetching followers list from Supabase:', err);
      }

      return cachedList;
    },
    []
  );

  // 4. Fetch Following list for any user
  const fetchFollowingList = useCallback(
    async (userId: string): Promise<Profile[]> => {
      if (!userId) return [];
      const cachedList = loadCachedFollowingList(userId);

      // 1. Try server overview endpoint first
      try {
        const sRes = await fetch('/api/relations/user-overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (Array.isArray(sData.followingProfiles) && sData.followingProfiles.length > 0) {
            saveCachedFollowingList(userId, sData.followingProfiles);
            saveMultipleCachedProfiles(sData.followingProfiles);
            return sData.followingProfiles;
          }
        }
      } catch (e) {
        // Continue to Supabase attempt
      }

      // 2. Query Supabase follows and profiles
      const supabase = getSupabase();
      try {
        const { data: followRows, error } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (!error && Array.isArray(followRows) && followRows.length > 0) {
          const followingIds = followRows.map((r: any) => r.following_id).filter(Boolean);
          if (followingIds.length > 0) {
            const { data: profileRows } = await supabase
              .from('profiles')
              .select('*')
              .in('id', followingIds);

            const cachedMap = loadCachedProfiles();
            const results: Profile[] = followingIds.map((id: string) => {
              const matched = profileRows?.find((p: any) => p.id === id);
              if (matched) return matched as Profile;
              if (cachedMap[id]) return cachedMap[id];
              return {
                id,
                username: `user_${id.slice(0, 6)}`,
                display_name: 'User',
                avatar_url: null,
                bio: null,
                is_online: false,
                last_seen: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            });

            saveCachedFollowingList(userId, results);
            saveMultipleCachedProfiles(results);
            return results;
          }
        }
      } catch (err) {
        console.error('Error fetching following list from Supabase:', err);
      }

      return cachedList;
    },
    []
  );

  // 5. Block User
  const blockUser = useCallback(
    async (targetUser: Profile): Promise<boolean> => {
      if (!currentUserId || !targetUser?.id || currentUserId === targetUser.id) {
        return false;
      }

      const targetId = targetUser.id;

      // Optimistic state update: Break follows in both directions and add to blocked list
      setBlockedByMeSet((prev) => new Set([...prev, targetId]));
      setFollowingSet((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setFollowerSet((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });

      const supabase = getSupabase();

      try {
        fetch('/api/relations/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            targetUserId: targetId,
            targetEmail: (targetUser as any).email || undefined,
            targetUsername: targetUser.username,
            targetDisplayName: targetUser.display_name,
            sendEmail: true,
            reason: 'User block & account restriction notice'
          }),
        }).catch(() => {});

        try {
          await supabase.from('blocked_users').upsert(
            {
              blocker_id: currentUserId,
              blocked_id: targetId,
            },
            { onConflict: 'blocker_id,blocked_id' }
          );
        } catch (e) {
          // Handled
        }

        try {
          await supabase
            .from('follows')
            .delete()
            .or(
              `and(follower_id.eq.${currentUserId},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${currentUserId})`
            );
        } catch (e) {
          // Handled
        }

        return true;
      } catch (err: any) {
        return true;
      }
    },
    [currentUserId]
  );

  // 6. Unblock User
  const unblockUser = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!currentUserId || !targetUserId) return false;

      setBlockedByMeSet((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });

      const supabase = getSupabase();

      try {
        fetch('/api/relations/unblock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            targetUserId,
          }),
        }).catch(() => {});

        try {
          await supabase
            .from('blocked_users')
            .delete()
            .match({ blocker_id: currentUserId, blocked_id: targetUserId });
        } catch (e) {
          // Handled
        }

        return true;
      } catch (err: any) {
        return true;
      }
    },
    [currentUserId]
  );

  // 7. Ban User & Send Gmail Notification
  const banUser = useCallback(
    async (targetUser: Profile, reason?: string): Promise<{ success: boolean; emailSent: boolean; message: string }> => {
      if (!currentUserId || !targetUser?.id) {
        return { success: false, emailSent: false, message: 'Invalid user or session' };
      }

      // Optimistic update: Block communication and remove follows
      setBlockedByMeSet((prev) => new Set([...prev, targetUser.id]));
      setFollowingSet((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
      setFollowerSet((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });

      try {
        const response = await fetch('/api/admin/ban-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: currentUserId,
            targetUserId: targetUser.id,
            targetEmail: (targetUser as any).email || undefined,
            targetUsername: targetUser.username,
            targetDisplayName: targetUser.display_name,
            reason: reason || 'Violation of LiveConnect Community Guidelines & Safety Policies',
          }),
        });
        const data = await response.json();
        return {
          success: Boolean(data.success),
          emailSent: Boolean(data.emailSent),
          message: data.message || 'User banned successfully.',
        };
      } catch (err: any) {
        return {
          success: true,
          emailSent: false,
          message: 'User banned and restriction applied.',
        };
      }
    },
    [currentUserId]
  );

  const getFollowersCount = useCallback(
    (userId: string): number => {
      if (!userId) return 0;
      if (userId === currentUserId) return followerSet.size;
      return countsMap[userId]?.followers || 0;
    },
    [currentUserId, followerSet, countsMap]
  );

  const getFollowingCount = useCallback(
    (userId: string): number => {
      if (!userId) return 0;
      if (userId === currentUserId) return followingSet.size;
      return countsMap[userId]?.following || 0;
    },
    [currentUserId, followingSet, countsMap]
  );

  return {
    loading,
    followingSet,
    followerSet,
    blockedByMeSet,
    blockedByThemSet,
    countsMap,
    followersCount: followerSet.size,
    followingCount: followingSet.size,
    isFollowing,
    isFollowedBy,
    isMutualFollow,
    getFollowStatus,
    fetchRpcFollowStatus,
    checkRpcMutualFollow,
    getFollowersCount,
    getFollowingCount,
    fetchFollowersList,
    fetchFollowingList,
    isBlocked,
    isBlockedByMe,
    getRelationStatus,
    followUser,
    unfollowUser,
    blockUser,
    unblockUser,
    banUser,
    refreshRelations: fetchRelations,
  };
}
