import React, { useState } from 'react';
import { X, Coins, Sparkles, Send, Users, Crown, Shield } from 'lucide-react';
import { LIVE_GIFT_CATALOG, LiveGift, LiveRoom, LiveVoiceSeat } from '@/src/types/live';
import { Profile } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface LiveGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: LiveRoom;
  currentUser: Profile;
  userCoins: number;
  initialTargetSeatIndex: number | null;
  onSendGift: (gift: LiveGift, recipient: Profile, targetSeatIndex?: number) => Promise<{ success: boolean; error?: string }>;
  onOpenCoinStore: () => void;
}

export const LiveGiftModal: React.FC<LiveGiftModalProps> = ({
  isOpen,
  onClose,
  room,
  currentUser,
  userCoins,
  initialTargetSeatIndex,
  onSendGift,
  onOpenCoinStore,
}) => {
  if (!isOpen) return null;

  const [selectedGiftId, setSelectedGiftId] = useState<string>(LIVE_GIFT_CATALOG[0].id);
  const [targetType, setTargetType] = useState<'seat' | 'owner' | 'all'>(
    initialTargetSeatIndex !== null && initialTargetSeatIndex >= 0 ? 'seat' : 'owner'
  );
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number>(
    initialTargetSeatIndex !== null && initialTargetSeatIndex >= 0 ? initialTargetSeatIndex : 0
  );
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedGift = LIVE_GIFT_CATALOG.find((g) => g.id === selectedGiftId) || LIVE_GIFT_CATALOG[0];

  // Occupied seats available as targets
  const occupiedSeats = room.seats.filter((s) => s.user !== null);

  // Calculate total coin cost
  const multiplier = targetType === 'all' ? Math.max(1, occupiedSeats.length) : 1;
  const totalCost = selectedGift.coins * multiplier;
  const hasEnoughCoins = userCoins >= totalCost;

  const handleSend = async () => {
    setErrorMsg(null);
    if (!hasEnoughCoins) {
      setErrorMsg(`Insufficient coins! You need ${totalCost.toLocaleString()} coins.`);
      return;
    }

    setIsSending(true);

    if (targetType === 'all') {
      // Send to all occupied seats
      for (const s of occupiedSeats) {
        if (s.user) {
          await onSendGift(selectedGift, s.user, s.seatIndex);
        }
      }
      setIsSending(false);
      onClose();
      return;
    }

    let recipient: Profile = room.owner;
    let seatIdx: number | undefined = undefined;

    if (targetType === 'seat') {
      const seat = room.seats[selectedSeatIndex];
      if (seat && seat.user) {
        recipient = seat.user;
        seatIdx = selectedSeatIndex;
      } else {
        recipient = room.owner;
      }
    } else {
      recipient = room.owner;
    }

    const res = await onSendGift(selectedGift, recipient, seatIdx);
    setIsSending(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Failed to send gift');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Send Virtual Gift</h3>
              <p className="text-xs text-neutral-400">Gifts trigger animated effects & sound</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Coins Balance Chip */}
            <button
              type="button"
              onClick={onOpenCoinStore}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
            >
              <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-300">{userCoins.toLocaleString()}</span>
              <span className="text-[10px] font-extrabold text-amber-400 ml-0.5 bg-amber-500/30 px-1 rounded-full">+</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Target Recipient Selector */}
        <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-950/40">
          <span className="text-xs font-semibold text-neutral-400 block mb-2">Select Recipient:</span>
          <div className="flex flex-wrap gap-2">
            {/* Owner option */}
            <button
              type="button"
              onClick={() => setTargetType('owner')}
              className={cn(
                'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                targetType === 'owner'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
              )}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Host ({room.owner.display_name})</span>
            </button>

            {/* Specific Seats */}
            {occupiedSeats.map((s) => (
              <button
                key={s.seatIndex}
                type="button"
                onClick={() => {
                  setTargetType('seat');
                  setSelectedSeatIndex(s.seatIndex);
                }}
                className={cn(
                  'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  targetType === 'seat' && selectedSeatIndex === s.seatIndex
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                )}
              >
                <span>Seat {s.seatIndex + 1}: {s.user?.display_name}</span>
              </button>
            ))}

            {/* All Seats Option */}
            {occupiedSeats.length > 1 && (
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={cn(
                  'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  targetType === 'all'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                )}
              >
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>All Seats ({occupiedSeats.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Gift Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-72">
          {LIVE_GIFT_CATALOG.map((gift) => {
            const isSelected = gift.id === selectedGiftId;
            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => {
                  setSelectedGiftId(gift.id);
                  setErrorMsg(null);
                }}
                className={cn(
                  'flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer relative group',
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                    : 'bg-neutral-800/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800'
                )}
              >
                {gift.animationType === 'rocket' || gift.animationType === 'party' ? (
                  <span className="absolute top-1 right-1 text-[8px] font-extrabold uppercase px-1 rounded bg-red-500/90 text-white">
                    Epic
                  </span>
                ) : null}

                <div className="text-3xl sm:text-4xl mb-1.5 transition-transform group-hover:scale-110">
                  {gift.icon}
                </div>
                <span className="text-xs font-bold text-neutral-200 text-center truncate max-w-full">
                  {gift.name}
                </span>
                <div className="flex items-center space-x-1 mt-1 text-amber-400">
                  <Coins className="w-3 h-3 fill-amber-400" />
                  <span className="text-[11px] font-bold">{gift.coins}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Insufficient Coins Warning */}
        {errorMsg && (
          <div className="px-5 py-2 bg-red-500/10 border-t border-b border-red-500/20 flex items-center justify-between">
            <span className="text-xs text-red-400 font-medium">{errorMsg}</span>
            <button
              type="button"
              onClick={onOpenCoinStore}
              className="text-xs font-bold text-amber-400 hover:underline ml-2 whitespace-nowrap"
            >
              Get Coins →
            </button>
          </div>
        )}

        {/* Footer with Send button */}
        <div className="px-5 py-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-neutral-400">Total:</span>
            <div className="flex items-center space-x-1 text-amber-400 font-extrabold text-sm">
              <Coins className="w-4 h-4 fill-amber-400" />
              <span>{totalCost.toLocaleString()}</span>
            </div>
            {targetType === 'all' && (
              <span className="text-[10px] text-neutral-500">
                ({selectedGift.coins} × {multiplier} seats)
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!hasEnoughCoins && (
              <button
                type="button"
                onClick={onOpenCoinStore}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-neutral-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-md"
              >
                + Buy Coins
              </button>
            )}

            <button
              type="button"
              disabled={isSending || !hasEnoughCoins}
              onClick={handleSend}
              className={cn(
                'flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md',
                hasEnoughCoins
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 hover:brightness-110 cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send Gift'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
