import React, { useState } from 'react';
import { X, Radio, Sparkles, Lock, Globe, Image as ImageIcon } from 'lucide-react';
import { LiveRoomCategory } from '@/src/types/live';
import { cn } from '@/src/lib/utils';

interface CreateLiveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (params: {
    name: string;
    description?: string;
    category: LiveRoomCategory;
    photoUrl?: string | null;
    isPrivate?: boolean;
  }) => Promise<any>;
}

const CATEGORIES: { id: LiveRoomCategory; label: string; icon: string }[] = [
  { id: 'chat', label: 'Casual Chat', icon: '💬' },
  { id: 'music', label: 'Music & Acoustic', icon: '🎵' },
  { id: 'gaming', label: 'Gaming & Esports', icon: '🎮' },
  { id: 'hangout', label: 'Social Hangout', icon: '☕' },
  { id: 'poetry', label: 'Poetry & Shayari', icon: '✍️' },
  { id: 'friendship', label: 'Global Friends', icon: '🌍' },
  { id: 'debate', label: 'Debate & Tech', icon: '💡' },
  { id: 'learning', label: 'Study & Language', icon: '📚' },
  { id: 'night', label: 'Late Night Chill', icon: '🌌' },
];

export const CreateLiveRoomModal: React.FC<CreateLiveRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LiveRoomCategory>('chat');
  const [isPrivate, setIsPrivate] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        photoUrl: photoUrl.trim() || null,
        isPrivate,
      });
      onClose();
    } catch (e) {}
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Go Live (Voice Room)</h3>
              <p className="text-xs text-neutral-400">Host 8 voice seats and audience</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">
              Room Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Late Night Acoustic & Casual Chat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'p-2 rounded-xl border text-center text-xs transition-all flex flex-col items-center justify-center space-y-1',
                    category === c.id
                      ? 'bg-red-500/20 border-red-500 text-red-200 font-bold'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  )}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[10px] truncate max-w-full">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Tell listeners what you will be talking about..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-300 block mb-1">Cover Image URL (Optional)</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-blue-400" />}
              <div>
                <p className="text-xs font-bold text-white">
                  {isPrivate ? 'Private Room' : 'Public Room'}
                </p>
                <p className="text-[10px] text-neutral-400">
                  {isPrivate ? 'Users must knock and be approved to enter' : 'Anyone in discovery can listen and request seat'}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-700 text-red-500 focus:ring-red-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
          >
            <Radio className="w-4 h-4" />
            <span>{isSubmitting ? 'Starting Live Room...' : 'Start Live Voice Room Now'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
