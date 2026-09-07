import React, { useState } from 'react';
import {
  X,
  Gamepad2,
  HelpCircle,
  BarChart2,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  Plus,
} from 'lucide-react';
import { LiveRoom, LiveRoomActivity } from '@/src/types/live';
import { Profile } from '@/src/types';
import { LiveStorageService } from '@/src/lib/live/live-storage';
import { cn } from '@/src/lib/utils';

interface LiveEntertainmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: LiveRoom;
  currentUser: Profile;
  canManageGames: boolean;
  onUpdateRoom: () => void;
}

const PRESET_QUIZZES = [
  {
    title: 'General Knowledge Sprint',
    type: 'quiz' as const,
    data: {
      question: 'Which planet in our solar system is known as the Red Planet?',
      options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
      correctIndex: 1,
      timeLimitSeconds: 20,
    },
  },
  {
    title: 'Music & Pop Culture Trivia',
    type: 'quiz' as const,
    data: {
      question: 'Which artist released the global record-breaking hit "Blinding Lights"?',
      options: ['Drake', 'Bruno Mars', 'The Weeknd', 'Post Malone'],
      correctIndex: 2,
      timeLimitSeconds: 20,
    },
  },
  {
    title: 'Guess the Movie from Emojis 🎬',
    type: 'emoji_guess' as const,
    data: {
      question: 'Guess the blockbuster movie: 🦁 👑 🌅',
      options: ['Madagascar', 'The Lion King', 'Tarzan', 'Jungle Book'],
      correctIndex: 1,
      timeLimitSeconds: 25,
    },
  },
  {
    title: 'Word Master Challenge 🔠',
    type: 'word_game' as const,
    data: {
      question: 'Unscramble the 9-letter community word: "H P O N M E I C R O"',
      options: ['MICROPHONE', 'PHONEMICRO', 'HOMOPHONES', 'MICROSCOPE'],
      correctIndex: 0,
      timeLimitSeconds: 25,
    },
  },
];

export const LiveEntertainmentModal: React.FC<LiveEntertainmentModalProps> = ({
  isOpen,
  onClose,
  room,
  currentUser,
  canManageGames,
  onUpdateRoom,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'current' | 'new_game' | 'new_poll'>('current');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Poll creation form state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Yes, absolutely!', 'Not really', 'Maybe later']);

  const activity = room.currentActivity;
  const hasVoted = activity && (activity.votes?.[currentUser.id] !== undefined || activity.answeredUsers?.[currentUser.id] !== undefined);

  const handleStartPreset = async (preset: typeof PRESET_QUIZZES[0]) => {
    if (!canManageGames) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/live/rooms/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: 'start',
          userId: currentUser.id,
          activityData: {
            type: preset.type,
            title: preset.title,
            startedBy: currentUser,
            data: preset.data,
          },
        }),
      });
      onUpdateRoom();
      setActiveTab('current');
    } catch (e) {}
    setIsSubmitting(false);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) return;
    setIsSubmitting(true);

    try {
      await fetch('/api/live/rooms/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: 'start',
          userId: currentUser.id,
          activityData: {
            type: 'poll',
            title: 'Live Room Community Poll',
            startedBy: currentUser,
            data: {
              question: pollQuestion.trim(),
              options: pollOptions.filter((o) => o.trim()),
            },
          },
        }),
      });
      onUpdateRoom();
      setActiveTab('current');
    } catch (e) {}
    setIsSubmitting(false);
  };

  const handleVoteOrAnswer = async (idx: number) => {
    if (!activity) return;
    setSelectedOption(idx);
    setIsSubmitting(true);

    try {
      if (activity.type === 'poll') {
        await fetch('/api/live/rooms/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            action: 'vote',
            userId: currentUser.id,
            optionIndex: idx,
          }),
        });
        LiveStorageService.addXp(currentUser.id, 5);
      } else {
        const res = await fetch('/api/live/rooms/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            action: 'answer',
            userId: currentUser.id,
            optionIndex: idx,
            timeMs: 4000,
          }),
        });
        const data = await res.json();
        if (data.isCorrect) {
          LiveStorageService.addXp(currentUser.id, 25);
        }
      }
      onUpdateRoom();
    } catch (e) {}
    setIsSubmitting(false);
  };

  const handleEndActivity = async () => {
    if (!canManageGames) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/live/rooms/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: 'end',
          userId: currentUser.id,
        }),
      });
      onUpdateRoom();
    } catch (e) {}
    setIsSubmitting(false);
  };

  // Compute poll vote percentages
  const totalVotes = activity?.votes ? Object.keys(activity.votes).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Live Entertainment</h3>
              <p className="text-xs text-neutral-400">Quizzes, Emoji Guess, Word Games & Polls</p>
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

        {/* Navigation Tabs */}
        <div className="px-5 py-2.5 bg-neutral-950/60 border-b border-neutral-800 flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors',
              activeTab === 'current'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            )}
          >
            Active Activity {activity?.isActive ? '🔴' : ''}
          </button>

          {canManageGames && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('new_game')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1',
                  activeTab === 'new_game'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Launch Game</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('new_poll')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1',
                  activeTab === 'new_poll'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Create Poll</span>
              </button>
            </>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* TAB 1: Current Activity */}
          {activeTab === 'current' && (
            <div>
              {activity && activity.isActive ? (
                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-extrabold text-[10px] uppercase border border-purple-500/30">
                      {activity.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">
                      by {activity.startedBy.display_name}
                    </span>
                  </div>

                  <h4 className="text-sm font-extrabold text-white">{activity.data.question}</h4>

                  {/* Options */}
                  <div className="space-y-2 mt-3">
                    {activity.data.options.map((opt: string, i: number) => {
                      const userAns = activity.answeredUsers?.[currentUser.id];
                      const userVote = activity.votes?.[currentUser.id];
                      const isSelected = userVote === i || userAns?.optionIndex === i || selectedOption === i;
                      const isCorrect = activity.data.correctIndex === i;
                      const showResult = userAns !== undefined || !activity.isActive;

                      // Count votes for this option
                      const voteCount = Object.values(activity.votes || {}).filter((v) => v === i).length;
                      const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={hasVoted || isSubmitting}
                          onClick={() => handleVoteOrAnswer(i)}
                          className={cn(
                            'w-full p-3 rounded-xl border text-left transition-all relative overflow-hidden flex items-center justify-between',
                            showResult && isCorrect
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                              : showResult && isSelected && !isCorrect
                              ? 'bg-red-500/20 border-red-500 text-red-200'
                              : isSelected
                              ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          {/* Vote progress fill bar for polls */}
                          {activity.type === 'poll' && (
                            <div
                              className="absolute inset-0 bg-purple-500/15 pointer-events-none transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          )}

                          <span className="relative z-10 text-xs font-semibold">{opt}</span>

                          <div className="relative z-10 flex items-center space-x-2">
                            {activity.type === 'poll' && (
                              <span className="text-xs font-bold text-neutral-400">{pct}% ({voteCount})</span>
                            )}
                            {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {canManageGames && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleEndActivity}
                        className="text-xs text-red-400 hover:underline font-bold"
                      >
                        End Activity
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <div className="text-4xl">🎲</div>
                  <h4 className="text-sm font-bold text-neutral-200">No Active Activity</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                    {canManageGames
                      ? 'Select a game or create a poll above to entertain the voice room audience!'
                      : 'The host or admin can launch trivia quizzes, emoji games, and polls here.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Launch Preset Games */}
          {activeTab === 'new_game' && canManageGames && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-neutral-400 block">Select a Game to Start:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_QUIZZES.map((quiz, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-purple-500/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">
                        {quiz.type.replace('_', ' ')}
                      </span>
                      <h5 className="text-xs font-bold text-white mt-1.5">{quiz.title}</h5>
                      <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{quiz.data.question}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStartPreset(quiz)}
                      className="mt-3 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                    >
                      Start This Game
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Create Custom Poll */}
          {activeTab === 'new_poll' && canManageGames && (
            <form onSubmit={handleCreatePoll} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Poll Question:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Which genre should we sing next?"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Options:</label>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      required
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...pollOptions];
                        updated[i] = e.target.value;
                        setPollOptions(updated);
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  ))}
                </div>

                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="mt-2 text-xs font-bold text-purple-400 hover:underline flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Option</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !pollQuestion.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-xs shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                Launch Community Poll
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
