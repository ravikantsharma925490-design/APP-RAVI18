import { useState, useEffect, useCallback } from 'react';
import { LiveRoom, LiveRoomCategory } from '../types/live';
import { Profile } from '../types';
import { LiveStorageService } from '../lib/live/live-storage';

export type LiveRoomsFilter = 'trending' | 'popular' | 'recommended' | 'new';

export function useLiveRoomsList(currentUser: Profile | null) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [filter, setFilter] = useState<LiveRoomsFilter>('trending');
  const [category, setCategory] = useState<LiveRoomCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [favoriteRoomIds, setFavoriteRoomIds] = useState<string[]>([]);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/live/rooms/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter,
          category,
          search: searchQuery,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setRooms(data.rooms);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live rooms:', e);
    } finally {
      setLoading(false);
    }
  }, [filter, category, searchQuery]);

  useEffect(() => {
    fetchRooms();
    setFavoriteRoomIds(LiveStorageService.getFavoriteRooms());

    // Periodic polling to update engagement and online counts
    const interval = setInterval(fetchRooms, 6000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const toggleFavorite = (roomId: string) => {
    const isFav = LiveStorageService.toggleFavoriteRoom(roomId);
    setFavoriteRoomIds(LiveStorageService.getFavoriteRooms());
    return isFav;
  };

  const createRoom = async (params: {
    name: string;
    description?: string;
    category: LiveRoomCategory;
    tags?: string[];
    photoUrl?: string | null;
    isPrivate?: boolean;
  }): Promise<LiveRoom | null> => {
    if (!currentUser) return null;
    try {
      const res = await fetch('/api/live/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          owner: currentUser,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          // Record room created achievement
          LiveStorageService.addXp(currentUser.id, 50);
          fetchRooms();
          return data.room;
        }
      }
    } catch (e) {
      console.warn('Failed to create room:', e);
    }
    return null;
  };

  return {
    rooms,
    filter,
    setFilter,
    category,
    setCategory,
    searchQuery,
    setSearchQuery,
    loading,
    refreshRooms: fetchRooms,
    isCreatingRoom,
    setIsCreatingRoom,
    createRoom,
    favoriteRoomIds,
    toggleFavorite,
  };
}
