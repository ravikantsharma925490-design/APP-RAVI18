import React, { useState, useEffect, useRef } from 'react';
import { WORLD_COUNTRIES } from '@/src/lib/worldData';
import { checkUsernameAvailability } from '@/src/hooks/useAuth';
import { User, CheckCircle2, AlertCircle, Camera, Sparkles, Globe, ChevronDown, Upload, Trash2, Loader2 } from 'lucide-react';
import { uploadMediaToB2 } from '@/src/lib/b2Client';

interface OnboardingScreenProps {
  prefillName?: string;
  prefillAvatar?: string;
  prefillEmail?: string;
  onComplete: (details: {
    username: string;
    displayName: string;
    country?: string;
    bio?: string;
    gender: string;
    avatarUrl?: string;
  }) => Promise<void>;
}

export function OnboardingScreen({
  prefillName = '',
  prefillAvatar = '',
  prefillEmail = '',
  onComplete,
}: OnboardingScreenProps) {
  const [displayName, setDisplayName] = useState(prefillName);
  const [username, setUsername] = useState(() => {
    if (prefillEmail) {
      return prefillEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    if (prefillName) {
      return prefillName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    return '';
  });
  const [avatarUrl, setAvatarUrl] = useState(prefillAvatar);
  const [country, setCountry] = useState('India');
  const [bio, setBio] = useState('Hey there! I am using LiveConnect.');
  const [gender, setGender] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture size must be 5 MB or less.');
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const res = await uploadMediaToB2({
        fileOrBlob: file,
        category: 'profile',
        userId: prefillEmail || username || 'onboarding',
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
      });

      if (res?.url) {
        setAvatarUrl(res.url);
      } else {
        throw new Error('Failed to get uploaded photo URL.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo to Backblaze B2.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Sync prefill values if they arrive asynchronously
  useEffect(() => {
    if (prefillName && !displayName) {
      setDisplayName(prefillName);
    }
    if (prefillAvatar && !avatarUrl) {
      setAvatarUrl(prefillAvatar);
    }
  }, [prefillName, prefillAvatar]);

  // Check username availability when typing
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || clean.length < 3) {
      setUsernameAvailable(null);
      setUsernameError(clean ? 'Username must be at least 3 characters.' : null);
      return;
    }

    setCheckingUsername(true);
    setUsernameError(null);

    const timer = setTimeout(async () => {
      try {
        const check = await checkUsernameAvailability(clean);
        if (check.available) {
          setUsernameAvailable(true);
          setUsernameError(null);
        } else {
          setUsernameAvailable(false);
          setUsernameError(check.message || 'Username is already taken.');
        }
      } catch (e) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUsernameError(null);

    if (!displayName.trim()) {
      setError('Display Name is required.');
      return;
    }

    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUser || cleanUser.length < 3) {
      setUsernameError('Username must be at least 3 characters (letters, numbers, _).');
      return;
    }

    if (!gender) {
      setError('Gender is required. Please select your gender.');
      return;
    }

    if (!country) {
      setError('Country is required. Please select your country.');
      return;
    }

    setLoading(true);
    try {
      const check = await checkUsernameAvailability(cleanUser);
      if (!check.available) {
        setUsernameError(check.message || 'Username is already taken.');
        setLoading(false);
        return;
      }

      await onComplete({
        username: cleanUser,
        displayName: displayName.trim(),
        country,
        bio: bio.trim(),
        gender,
        avatarUrl: avatarUrl.trim() || undefined,
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong while saving your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe w-full flex items-center justify-center p-4 bg-neutral-950 text-white relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg p-8 md:p-10 rounded-3xl bg-neutral-900/95 border border-neutral-800 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Profile Setup</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Set Up Your Profile
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            Please complete required details before continuing to LiveConnect.
          </p>
        </div>

        {/* Profile Photo Preview & Upload */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp, image/gif"
            onChange={handlePhotoUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative group cursor-pointer"
            title="Click to upload profile photo"
          >
            <div className="w-24 h-24 rounded-2xl bg-neutral-800 border-2 border-blue-500/50 overflow-hidden flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:border-blue-400 transition-all">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile Photo"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <User className="w-10 h-10 text-neutral-400" />
              )}
            </div>

            {/* Camera Overlay Badge */}
            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera className="w-6 h-6" />
            </div>

            {prefillAvatar && avatarUrl === prefillAvatar && (
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow border border-blue-400/40">
                Google
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{uploadingPhoto ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => setAvatarUrl('')}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-neutral-400 font-medium text-center">
            {uploadingPhoto
              ? 'Uploading to Backblaze B2...'
              : avatarUrl
              ? prefillAvatar && avatarUrl === prefillAvatar
                ? 'Photo imported from Google account (click to change)'
                : 'Custom photo selected (Backblaze B2)'
              : 'Upload custom photo or use avatar'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed animate-in fade-in flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name (Required) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full py-2.5 px-3.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Your public name visible to other users on LiveConnect.
            </p>
          </div>

          {/* Username (Required & Unique) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Username <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">
                @
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="rahul_sharma"
                className="w-full pl-8 pr-10 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
              />
              {checkingUsername && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-neutral-400/30 border-t-neutral-200 rounded-full animate-spin" />
              )}
              {!checkingUsername && usernameAvailable === true && (
                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              )}
              {!checkingUsername && usernameAvailable === false && (
                <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
              )}
            </div>
            {usernameError ? (
              <p className="text-xs text-red-400 font-medium mt-1">{usernameError}</p>
            ) : usernameAvailable === true ? (
              <p className="text-xs text-emerald-400 font-medium mt-1">Username is available!</p>
            ) : (
              <p className="text-[11px] text-neutral-500 mt-1">
                Unique handler ID (letters, numbers, underscores only).
              </p>
            )}
          </div>

          {/* Gender (Required) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Gender <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
            >
              <option value="" disabled>
                -- Select Gender (Required) --
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Bio (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Bio <span className="text-neutral-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others a bit about yourself..."
              rows={2}
              className="w-full py-2.5 px-3.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Country <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="">Select Country</option>
                {WORLD_COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
                <option value="Other">🌍 Other</option>
              </select>
              <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Submit / Continue Button */}
          <button
            type="submit"
            disabled={loading || checkingUsername || usernameAvailable === false}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] mt-2"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Profile...</span>
              </div>
            ) : (
              'Save Profile & Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
