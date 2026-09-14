import React, { useState } from 'react';
import { WORLD_COUNTRIES } from '@/src/lib/worldData';
import { checkUsernameAvailability } from '@/src/hooks/useAuth';

interface OnboardingScreenProps {
  prefillName: string;
  onComplete: (details: {
    username: string;
    displayName: string;
    country: string;
    bio: string;
    gender: string;
  }) => Promise<void>;
}

export function OnboardingScreen({ prefillName, onComplete }: OnboardingScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUsernameError(null);

    if (!username.trim() || username.trim().length < 3) {
      setUsernameError('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      const check = await checkUsernameAvailability(username.trim());
      if (!check.available) {
        setUsernameError(check.message || 'Username is not available.');
        setLoading(false);
        return;
      }
      await onComplete({ username: username.trim(), displayName, country, bio, gender });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe w-full flex items-center justify-center p-4 bg-neutral-950 text-white">
      <div className="w-full max-w-md p-8 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-extrabold text-white">Complete your profile</h1>
          <p className="text-xs text-neutral-400">Just a few details to get you started on LiveConnect</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-base"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="choose_a_username"
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-base"
              required
            />
            {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-base"
              required
            >
              <option value="" disabled>Select your country</option>
              {WORLD_COUNTRIES.map((c: any) => (
                <option key={c.name || c} value={c.name || c}>{c.name || c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-base"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Hey there! I am using LiveConnect."
              rows={2}
              className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-base resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold"
          >
            {loading ? 'Saving...' : 'Continue to LiveConnect'}
          </button>
        </form>
      </div>
    </div>
  );
}
