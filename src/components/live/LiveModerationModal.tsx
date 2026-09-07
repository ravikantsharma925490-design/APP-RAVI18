import React, { useState } from 'react';
import {
  X,
  Shield,
  Crown,
  Lock,
  Unlock,
  VolumeX,
  UserX,
  UserMinus,
  Edit3,
  UserCheck,
  Check,
  Music,
  Gamepad2,
  Trash2,
  DoorClosed,
} from 'lucide-react';
import { LiveRoom, LiveRoomAdminPermissions } from '@/src/types/live';
import { Profile } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface LiveModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: LiveRoom;
  currentUser: Profile;
  onAction: (action: string, targetUserId?: string, seatIdx?: number, payload?: any) => Promise<any>;
  onCloseRoom: () => void;
}

export const LiveModerationModal: React.FC<LiveModerationModalProps> = ({
  isOpen,
  onClose,
  room,
  currentUser,
  onAction,
  onCloseRoom,
}) => {
  if (!isOpen) return null;

  const isOwner = currentUser.id === room.ownerId;
  const isAdmin = currentUser.id === room.adminId;

  const [activeTab, setActiveTab] = useState<'admin' | 'seats' | 'knocks' | 'bans' | 'room_info'>('admin');
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit room form
  const [roomName, setRoomName] = useState(room.name);
  const [roomDesc, setRoomDesc] = useState(room.description);
  const [isPrivate, setIsPrivate] = useState(room.isPrivate);

  // Admin permissions form
  const [adminPerms, setAdminPerms] = useState<LiveRoomAdminPermissions>({
    canMute: room.adminPermissions.canMute,
    canKick: room.adminPermissions.canKick,
    canBan: room.adminPermissions.canBan,
    canLockSeats: room.adminPermissions.canLockSeats,
    canPlayMusic: room.adminPermissions.canPlayMusic,
    canManageGames: room.adminPermissions.canManageGames,
  });

  const handleToggleAdminPerm = async (key: keyof LiveRoomAdminPermissions) => {
    if (!isOwner) return;
    const updated = { ...adminPerms, [key]: !adminPerms[key] };
    setAdminPerms(updated);
    setIsProcessing(true);
    await onAction('update_admin_permissions', undefined, undefined, { permissions: updated });
    setIsProcessing(false);
  };

  const handleSaveRoomInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setIsProcessing(true);
    await onAction('update_room_info', undefined, undefined, {
      name: roomName,
      description: roomDesc,
      isPrivate,
    });
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Room Moderation</h3>
              <p className="text-xs text-neutral-400">
                {isOwner ? 'Owner & Admin Management' : 'Admin Controls'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 bg-neutral-950/60 border-b border-neutral-800 flex items-center space-x-1 overflow-x-auto text-xs font-semibold">
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap',
                activeTab === 'admin' ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              )}
            >
              Admin Role (1 Max)
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('seats')}
            className={cn(
              'px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap',
              activeTab === 'seats' ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            )}
          >
            Voice Seats (8)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('knocks')}
            className={cn(
              'px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap flex items-center space-x-1',
              activeTab === 'knocks' ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            )}
          >
            <span>Knock Requests</span>
            {room.pendingJoinRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-extrabold">
                {room.pendingJoinRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bans')}
            className={cn(
              'px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap',
              activeTab === 'bans' ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            )}
          >
            Banned ({room.bannedUserIds.length})
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('room_info')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap',
                activeTab === 'room_info' ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              )}
            >
              Room Info
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: Admin Assignment & Permissions */}
          {activeTab === 'admin' && isOwner && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 block mb-1">
                  Active Room Admin (Strictly 1 Admin allowed)
                </span>

                {room.admin ? (
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center font-bold text-white">
                        {room.admin.avatar_url ? (
                          <img src={room.admin.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          room.admin.display_name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white flex items-center space-x-1">
                          <span>{room.admin.display_name}</span>
                          <Shield className="w-3.5 h-3.5 text-blue-400 fill-current" />
                        </p>
                        <p className="text-[11px] text-neutral-400">@{room.admin.username}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => onAction('remove_admin')}
                      className="px-3 py-1.5 rounded-xl bg-red-950/50 text-red-300 border border-red-800/60 hover:bg-red-900/50 text-xs font-bold transition-colors"
                    >
                      Remove Admin
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 mt-1">
                    No Admin currently appointed. Open a participant's Profile Card to appoint them as Admin.
                  </p>
                )}
              </div>

              {/* Granular Permissions granted by Owner */}
              {room.admin && (
                <div>
                  <span className="text-xs font-bold text-neutral-300 block mb-2">
                    Admin Permissions Granted by Owner:
                  </span>
                  <div className="space-y-2">
                    {[
                      { key: 'canMute' as const, label: 'Can Mute Seat Occupants', icon: VolumeX },
                      { key: 'canKick' as const, label: 'Can Kick Users', icon: UserMinus },
                      { key: 'canBan' as const, label: 'Can Ban Users', icon: UserX },
                      { key: 'canLockSeats' as const, label: 'Can Lock / Unlock Voice Seats', icon: Lock },
                      { key: 'canPlayMusic' as const, label: 'Can Play & Broadcast Local Music', icon: Music },
                      { key: 'canManageGames' as const, label: 'Can Launch Quizzes & Polls', icon: Gamepad2 },
                    ].map(({ key, label, icon: Icon }) => (
                      <div
                        key={key}
                        onClick={() => handleToggleAdminPerm(key)}
                        className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between cursor-pointer hover:border-neutral-700"
                      >
                        <div className="flex items-center space-x-2.5">
                          <Icon className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-semibold text-neutral-200">{label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={adminPerms[key]}
                          readOnly
                          className="h-4 w-4 rounded border-neutral-700 text-blue-500 focus:ring-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Voice Seats Locks & Kicks */}
          {activeTab === 'seats' && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-400 block mb-1">
                Manage 8 Voice Seats:
              </span>
              {room.seats.map((seat) => (
                <div
                  key={seat.seatIndex}
                  className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-full bg-neutral-800 text-[11px] font-bold text-neutral-400 flex items-center justify-center border border-neutral-700">
                      {seat.seatIndex + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {seat.user ? seat.user.display_name : seat.isLocked ? 'Locked Seat' : 'Empty Seat'}
                      </p>
                      {seat.user && (
                        <p className="text-[10px] text-neutral-400">
                          {seat.isMuted ? 'Muted' : 'Mic Active'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Lock / Unlock */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        onAction(seat.isLocked ? 'unlock_seat' : 'lock_seat', undefined, seat.seatIndex)
                      }
                      className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs"
                      title={seat.isLocked ? 'Unlock Seat' : 'Lock Seat'}
                    >
                      {seat.isLocked ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>

                    {/* Mute Seat Occupant */}
                    {seat.user && seat.user.id !== room.ownerId && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          onAction(seat.isMuted ? 'unmute_seat' : 'mute_seat', seat.user!.id, seat.seatIndex)
                        }
                        className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs"
                        title="Mute / Unmute"
                      >
                        <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}

                    {/* Remove from Seat */}
                    {seat.user && seat.user.id !== room.ownerId && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => onAction('leave_seat', seat.user!.id, seat.seatIndex)}
                        className="p-1.5 rounded-lg bg-red-950/40 text-red-400 hover:text-red-300 border border-red-800/40 text-xs"
                        title="Remove from seat"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Knock Requests (Private Room Approval) */}
          {activeTab === 'knocks' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-neutral-400 block">
                Pending Knock Requests ({room.pendingJoinRequests.length}):
              </span>
              {room.pendingJoinRequests.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No pending knock requests.
                </p>
              ) : (
                room.pendingJoinRequests.map((req) => (
                  <div
                    key={req.user.id}
                    className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{req.user.display_name}</p>
                      <p className="text-[10px] text-neutral-400">@{req.user.username}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => onAction('approve_private_join', req.user.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction('reject_private_join', req.user.id)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: Banned Users */}
          {activeTab === 'bans' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-neutral-400 block">
                Banned User IDs ({room.bannedUserIds.length}):
              </span>
              {room.bannedUserIds.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No users banned from this room.
                </p>
              ) : (
                room.bannedUserIds.map((bId) => (
                  <div
                    key={bId}
                    className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between"
                  >
                    <span className="text-xs font-mono text-neutral-300">{bId}</span>
                    <span className="text-[10px] font-bold text-red-400 uppercase">Banned</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: Room Info & Close (Owner only) */}
          {activeTab === 'room_info' && isOwner && (
            <form onSubmit={handleSaveRoomInfo} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="privCheck"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-700 text-blue-500"
                />
                <label htmlFor="privCheck" className="text-xs text-neutral-300 cursor-pointer">
                  Private Room (Knock / approval required)
                </label>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                Save Room Details
              </button>

              <div className="pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={onCloseRoom}
                  className="w-full py-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/50 text-red-300 border border-red-800/60 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <DoorClosed className="w-4 h-4" />
                  <span>Close Room Permanently</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
