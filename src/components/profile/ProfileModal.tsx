import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  AtSign,
  FileText,
  Check,
  Sparkles,
  Globe,
  Calendar,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Phone,
  Video,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  UserCheck,
  UserPlus,
  Mail,
} from 'lucide-react';
import { Profile, UserRelationStatus } from '@/src/types';
import { cn, getAvatarColor, getInitials, formatJoinedYear } from '@/src/lib/utils';
import { checkUsernameAvailability } from '@/src/hooks/useAuth';
import { WORLD_COUNTRIES } from '@/src/lib/worldData';
import { FollowButton, FollowStatus } from './FollowButton';
import { FollowsListModal } from './FollowsListModal';

interface ProfileModalProps {
  isOpen: boolean;
  currentUser: Profile | null;
  viewingProfile?: Profile | null;
  onClose: () => void;
  onUpdateProfile: (updates: Partial<Profile>) => Promise<any>;
  relationStatus?: UserRelationStatus;
  getFollowStatus?: (userId: string) => FollowStatus;
  onFollow?: (target: Profile | string) => Promise<boolean | void>;
  onUnfollow?: (target: Profile | string) => Promise<boolean | void>;
  fetchFollowers?: (userId: string) => Promise<Profile[]>;
  fetchFollowing?: (userId: string) => Promise<Profile[]>;
  followersCount?: number;
  followingCount?: number;
  onSelectUser?: (user: Profile) => void;
  onBlock?: (user: Profile) => Promise<boolean>;
  onUnblock?: (userId: string) => Promise<boolean>;
  onStartChat?: (userId: string) => void;
  onStartAudioCall?: (user: Profile) => void;
  onStartVideoCall?: (user: Profile) => void;
  isUserOnline?: (profile?: Profile | null) => boolean;
}

export const COUNTRIES = WORLD_COUNTRIES;


export const GENDER_OPTIONS = [
  { id: 'Male', label: 'Male', emoji: '👨' },
  { id: 'Female', label: 'Female', emoji: '👩' },
  { id: 'Non-Binary', label: 'Non-Binary', emoji: '🧑' },
  { id: 'Other', label: 'Other', emoji: '✨' },
  { id: 'Prefer not to say', label: 'Prefer not to say', emoji: '🔒' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  currentUser,
  viewingProfile,
  onClose,
  onUpdateProfile,
  relationStatus,
  getFollowStatus,
  onFollow,
  onUnfollow,
  fetchFollowers,
  fetchFollowing,
  followersCount,
  followingCount,
  onSelectUser,
  onBlock,
  onUnblock,
  onStartChat,
  onStartAudioCall,
  onStartVideoCall,
  isUserOnline,
}) => {
  const targetUser = viewingProfile || currentUser;
  const isEditingSelf = Boolean(currentUser && (!viewingProfile || viewingProfile.id === currentUser.id));
  const isTargetOnline = isEditingSelf ? true : isUserOnline ? isUserOnline(targetUser) : Boolean(targetUser?.is_online);

  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [gender, setGender] = useState<string>(currentUser?.gender || '');
  const [country, setCountry] = useState<string>(currentUser?.country || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameFeedback, setUsernameFeedback] = useState<string>('');
  const checkTimerRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Follows List Modal state
  const [showFollowsModal, setShowFollowsModal] = useState(false);
  const [followsListInitialTab, setFollowsListInitialTab] = useState<'followers' | 'following'>('followers');

  // Check username availability when user modifies username
  useEffect(() => {
    if (!isOpen || !isEditingSelf) {
      setUsernameStatus('idle');
      setUsernameFeedback('');
      return;
    }

    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean) {
      setUsernameStatus('idle');
      setUsernameFeedback('');
      return;
    }

    // If matches currentUser username, it is valid/current
    if (currentUser && clean === currentUser.username.toLowerCase()) {
      setUsernameStatus('available');
      setUsernameFeedback('Your current username');
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus('invalid');
      setUsernameFeedback('Username must be at least 3 characters.');
      return;
    }

    setUsernameStatus('checking');
    setUsernameFeedback('Checking availability...');

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(clean, currentUser?.id);
        if (res.available) {
          setUsernameStatus('available');
          setUsernameFeedback(`✓ @${clean} is available!`);
        } else {
          setUsernameStatus('taken');
          setUsernameFeedback(res.message || `✕ @${clean} is already taken.`);
        }
      } catch (err) {
        setUsernameStatus('available');
        setUsernameFeedback('');
      }
    }, 350);

    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
      }
    };
  }, [username, isOpen, isEditingSelf, currentUser]);

  // Sync state when modal opens or currentUser changes
  useEffect(() => {
    if (currentUser && isEditingSelf) {
      setDisplayName(currentUser.display_name || '');
      setUsername(currentUser.username || '');
      setBio(currentUser.bio || '');
      setGender(currentUser.gender || '');
      setCountry(currentUser.country || '');
      setAvatarUrl(currentUser.avatar_url || '');
      setErrorMessage(null);
    }
  }, [currentUser, isEditingSelf, isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingSelf) return;

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters (letters, numbers, or underscores).');
      return;
    }

    if (usernameStatus === 'taken') {
      setErrorMessage(`Username "@${cleanUsername}" is already taken by another user. Please choose a different username.`);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      await onUpdateProfile({
        display_name: displayName.trim() || cleanUsername,
        username: cleanUsername,
        bio: bio.trim(),
        gender: gender || null,
        country: country || null,
        avatar_url: avatarUrl || null,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setRandomAvatar = () => {
    const name = encodeURIComponent(displayName || username || 'User');
    const randomBg = ['3b82f6', '8b5cf6', 'ec4899', '10b981', 'f59e0b', '6366f1'][
      Math.floor(Math.random() * 6)
    ];
    setAvatarUrl(`https://ui-avatars.com/api/?name=${name}&background=${randomBg}&color=fff&bold=true`);
  };

  const handleBlockToggle = async () => {
    if (!targetUser || actionLoading) return;
    setActionLoading(true);
    try {
      if (relationStatus?.isBlockedByMe) {
        if (onUnblock) await onUnblock(targetUser.id);
        setShowBlockConfirm(false);
      } else {
        if (onBlock) await onBlock(targetUser);
        setShowBlockConfirm(false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Find country details if selected
  const selectedCountryObj = COUNTRIES.find((c) => c.name === (isEditingSelf ? country : targetUser.country));
  const selectedGenderObj = GENDER_OPTIONS.find((g) => g.id === (isEditingSelf ? gender : targetUser.gender));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>{isEditingSelf ? 'Edit Your Profile' : 'User Profile'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Avatar preview */}
          <div className="flex flex-col items-center">
            <div className="relative mb-3">
              {(isEditingSelf ? avatarUrl : targetUser.avatar_url) ? (
                <img
                  src={isEditingSelf ? avatarUrl : (targetUser.avatar_url as string)}
                  alt="Avatar"
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-neutral-100 dark:border-neutral-800 shadow-lg"
                />
              ) : (
                <div
                  className={cn(
                    'w-24 h-24 rounded-3xl flex items-center justify-center font-bold text-2xl shadow-lg border-4 border-neutral-100 dark:border-neutral-800 text-white',
                    getAvatarColor(targetUser.id)
                  )}
                >
                  {getInitials(targetUser.display_name)}
                </div>
              )}

              {/* Online Indicator */}
              <span
                className={cn(
                  'absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-neutral-900',
                  isTargetOnline ? 'bg-emerald-500 shadow-sm' : 'bg-neutral-400'
                )}
                title={isTargetOnline ? 'Online' : 'Offline'}
              />
            </div>

            <h4 className="font-bold text-lg text-neutral-900 dark:text-neutral-100 text-center flex items-center gap-2">
              <span>{isEditingSelf ? (displayName || 'Your Name') : targetUser.display_name}</span>
            </h4>
            <div className="flex items-center gap-2 justify-center">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                @{isEditingSelf ? (username || 'username') : targetUser.username}
              </p>
              {!isEditingSelf && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                    isTargetOnline
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', isTargetOnline ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400')} />
                  {isTargetOnline ? 'Online' : 'Offline'}
                </span>
              )}
            </div>

            {/* Followers and Following Counters */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFollowsListInitialTab('followers');
                  setShowFollowsModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer group"
              >
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {typeof followersCount === 'number' ? followersCount : (relationStatus?.followersCount ?? 0)}
                </span>
                <span className="text-[11px] text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Followers
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFollowsListInitialTab('following');
                  setShowFollowsModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer group"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {typeof followingCount === 'number' ? followingCount : (relationStatus?.followingCount ?? 0)}
                </span>
                <span className="text-[11px] text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Following
                </span>
              </button>
            </div>

            {/* Follow / Follow Back / Following Button on other user's profile */}
            {!isEditingSelf && targetUser && getFollowStatus && onFollow && onUnfollow && (
              <div className="pt-2 flex justify-center">
                <FollowButton
                  currentUserId={currentUser?.id}
                  targetUser={targetUser}
                  followStatus={getFollowStatus(targetUser.id)}
                  onFollow={onFollow}
                  onUnfollow={onUnfollow}
                  size="md"
                  className="w-full max-w-[200px]"
                />
              </div>
            )}

            {/* Blocked Badge if user is blocked */}
            {!isEditingSelf && relationStatus?.isBlocked && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{relationStatus.isBlockedByMe ? 'Blocked by you' : 'Communication Blocked'}</span>
                </span>
              </div>
            )}

            {isEditingSelf && (
              <button
                type="button"
                onClick={setRandomAvatar}
                className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Random Avatar</span>
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400">
              {errorMessage}
            </div>
          )}

          {/* Form or View details */}
          {isEditingSelf ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name or nickname"
                    className="w-full pl-10 pr-3.5 py-2.5 text-base rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Username (@username) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Username
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    letters, numbers, _
                  </span>
                </div>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                      )
                    }
                    placeholder="username (min 3 chars)"
                    className={cn(
                      'w-full pl-10 pr-10 py-2.5 text-sm rounded-2xl border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-2',
                      usernameStatus === 'available'
                        ? 'border-emerald-500/60 focus:ring-emerald-500'
                        : usernameStatus === 'taken'
                        ? 'border-red-500/60 focus:ring-red-500'
                        : 'border-neutral-300 dark:border-neutral-700 focus:ring-blue-500'
                    )}
                  />
                  {/* Status indicator icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    {usernameStatus === 'taken' && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
                {usernameFeedback && (
                  <p
                    className={cn(
                      'text-[11px] mt-1 pl-1 font-medium transition-all',
                      usernameStatus === 'available'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : usernameStatus === 'taken'
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-neutral-400'
                    )}
                  >
                    {usernameFeedback}
                  </p>
                )}
              </div>

              {/* Gender & Country in 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Gender
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 text-sm rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                      <option value="">Select Gender</option>
                      {GENDER_OPTIONS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.emoji} {g.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Country
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 text-sm rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                      <option value="">Select Country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                      <option value="Other">🌍 Other</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Bio / Status */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Bio / Status
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others about yourself..."
                    className="w-full pl-10 pr-3.5 py-2.5 text-base rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-2xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Saved!
                    </>
                  ) : saving ? (
                    'Saving...'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* View-only mode for other users with Direct Message, Audio & Video Calls, and Block Actions */
            <div className="space-y-4">
              {/* Follow Status Notice */}
              {!relationStatus?.isBlocked && targetUser && !(() => {
                const fStatus = getFollowStatus?.(targetUser.id);
                const isF = fStatus === 'following' || fStatus === 'mutual' || Boolean(relationStatus?.isFollowing);
                const isFB = fStatus === 'followed_by' || fStatus === 'mutual' || Boolean(relationStatus?.isFollowedBy);
                const isMutual = fStatus === 'mutual' || Boolean(relationStatus?.isMutual) || (isF && isFB);
                return isMutual;
              })() && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 text-center space-y-1">
                  <p className="font-bold flex items-center justify-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    <span>Mutual Follow Required</span>
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Both users must follow each other to exchange messages and make audio or video calls.
                  </p>
                </div>
              )}

              {/* Direct Communication Buttons (Message, Audio Call, Video Call) */}
              <div className="grid grid-cols-3 gap-2.5">
                {(() => {
                  const isSelf = Boolean(currentUser?.id && targetUser?.id && currentUser.id === targetUser.id);
                  const fStatus = targetUser ? getFollowStatus?.(targetUser.id) : undefined;
                  const isF = fStatus === 'following' || fStatus === 'mutual' || Boolean(relationStatus?.isFollowing);
                  const isFB = fStatus === 'followed_by' || fStatus === 'mutual' || Boolean(relationStatus?.isFollowedBy);
                  const isMutual = isSelf || fStatus === 'mutual' || Boolean(relationStatus?.isMutual) || (isF && isFB);
                  const canCommunicate = !relationStatus?.isBlocked && isMutual;

                  return (
                    <>
                      {/* Direct Message Button */}
                      <button
                        onClick={() => {
                          if (onStartChat && targetUser && canCommunicate) {
                            onStartChat(targetUser.id);
                            onClose();
                          }
                        }}
                        disabled={!canCommunicate}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl text-xs font-bold transition-all',
                          canCommunicate
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed opacity-60'
                        )}
                        title={
                          relationStatus?.isBlocked
                            ? 'User is blocked'
                            : 'Message user'
                        }
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Message</span>
                      </button>

                      {/* Direct Audio Call Button */}
                      <button
                        onClick={() => {
                          if (onStartAudioCall && targetUser && canCommunicate) {
                            onStartAudioCall(targetUser);
                            onClose();
                          }
                        }}
                        disabled={!canCommunicate}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl text-xs font-bold transition-all',
                          canCommunicate
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-60'
                        )}
                        title={
                          relationStatus?.isBlocked
                            ? 'User is blocked'
                            : 'Start Audio Call'
                        }
                      >
                        <Phone className="w-4 h-4" />
                        <span>Audio Call</span>
                      </button>

                      {/* Direct Video Call Button */}
                      <button
                        onClick={() => {
                          if (onStartVideoCall && targetUser && canCommunicate) {
                            onStartVideoCall(targetUser);
                            onClose();
                          }
                        }}
                        disabled={!canCommunicate}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl text-xs font-bold transition-all',
                          canCommunicate
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-60'
                        )}
                        title={
                          relationStatus?.isBlocked
                            ? 'User is blocked'
                            : 'Start Video Call'
                        }
                      >
                        <Video className="w-4 h-4" />
                        <span>Video Call</span>
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Gender & Country Badges */}
              {(targetUser.gender || targetUser.country) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {targetUser.gender && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      <span>{selectedGenderObj?.emoji || '👤'}</span>
                      <span>{targetUser.gender}</span>
                    </span>
                  )}
                  {targetUser.country && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                      <span>{selectedCountryObj?.flag || '🌍'}</span>
                      <span>{targetUser.country}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Bio details */}
              <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 text-sm">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1 font-bold uppercase tracking-wider">
                  Bio / Status
                </p>
                <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed">
                  {targetUser.bio || 'Hey there! I am using LiveConnect.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span>Joined {formatJoinedYear(targetUser.created_at)}</span>
              </div>

              {/* Block / Unblock Management */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                {showBlockConfirm ? (
                  <div className="w-full p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                      Block & Ban <strong>@{targetUser.username}</strong>? This will restrict their communication and send an <strong>official Ban Notice email to their Gmail inbox</strong>.
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span>Gmail Notice Enabled</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowBlockConfirm(false)}
                          className="px-3 py-1.5 text-xs rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleBlockToggle}
                          disabled={actionLoading}
                          className="px-3.5 py-1.5 text-xs rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Ban & Send Email</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (relationStatus?.isBlockedByMe) {
                          handleBlockToggle();
                        } else {
                          setShowBlockConfirm(true);
                        }
                      }}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      {relationStatus?.isBlockedByMe ? (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Unblock User</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4" />
                          <span>Block User</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={onClose}
                      className="px-5 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-2xl transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Follows List Modal for viewing followers / following */}
      {fetchFollowers && fetchFollowing && targetUser && (
        <FollowsListModal
          isOpen={showFollowsModal}
          onClose={() => setShowFollowsModal(false)}
          userId={targetUser.id}
          userDisplayName={targetUser.display_name}
          initialTab={followsListInitialTab}
          currentUserId={currentUser?.id}
          onSelectUser={(u) => {
            setShowFollowsModal(false);
            if (onSelectUser) {
              onSelectUser(u);
            }
          }}
          getFollowStatus={getFollowStatus}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          fetchFollowers={fetchFollowers}
          fetchFollowing={fetchFollowing}
          followersCount={typeof followersCount === 'number' ? followersCount : relationStatus?.followersCount}
          followingCount={typeof followingCount === 'number' ? followingCount : relationStatus?.followingCount}
        />
      )}
    </div>
  );
};
