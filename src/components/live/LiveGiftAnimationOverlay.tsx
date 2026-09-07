import React from 'react';
import { LiveGiftEvent } from '@/src/types/live';

interface LiveGiftAnimationOverlayProps {
  giftEvent: LiveGiftEvent | null;
}

export const LiveGiftAnimationOverlay: React.FC<LiveGiftAnimationOverlayProps> = ({ giftEvent }) => {
  if (!giftEvent) return null;

  const { gift, sender, recipient } = giftEvent;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      {/* Top Banner Announcement */}
      <div className="absolute top-20 animate-bounce flex items-center space-x-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-600/95 via-orange-500/95 to-amber-600/95 text-white shadow-2xl border border-amber-300/60 backdrop-blur-md">
        <span className="text-2xl">{gift.icon}</span>
        <div className="text-center">
          <p className="text-xs font-bold text-amber-100">
            <span className="text-white font-extrabold">{sender.display_name}</span> sent{' '}
            <span className="text-amber-200 font-extrabold">{gift.name}</span> to{' '}
            <span className="text-white font-extrabold">{recipient.display_name}</span>!
          </p>
        </div>
        <span className="text-2xl">{gift.icon}</span>
      </div>

      {/* Main Center Animation depending on type */}
      {gift.animationType === 'rocket' && (
        <div className="relative flex flex-col items-center animate-rocket-launch">
          <div className="text-8xl drop-shadow-[0_15px_30px_rgba(255,100,0,0.6)]">🚀</div>
          <div className="w-12 h-24 bg-gradient-to-t from-transparent via-orange-500 to-amber-300 blur-sm rounded-full animate-pulse mt-2" />
        </div>
      )}

      {gift.animationType === 'crown' && (
        <div className="relative flex flex-col items-center animate-crown-float">
          <div className="text-9xl drop-shadow-[0_10px_35px_rgba(255,215,0,0.8)] animate-spin-slow">
            👑
          </div>
          <div className="flex space-x-2 mt-2">
            <span className="text-2xl animate-ping">✨</span>
            <span className="text-2xl animate-pulse">⭐</span>
            <span className="text-2xl animate-ping">✨</span>
          </div>
        </div>
      )}

      {gift.animationType === 'rose' && (
        <div className="relative flex flex-col items-center">
          <div className="text-8xl animate-bounce drop-shadow-[0_10px_25px_rgba(255,0,80,0.6)]">
            🌹
          </div>
          <div className="absolute inset-0 flex justify-around pointer-events-none w-72 h-72">
            <span className="text-3xl animate-petal-fall" style={{ animationDelay: '0.1s' }}>🌸</span>
            <span className="text-2xl animate-petal-fall" style={{ animationDelay: '0.3s' }}>🌹</span>
            <span className="text-3xl animate-petal-fall" style={{ animationDelay: '0.5s' }}>🥀</span>
            <span className="text-2xl animate-petal-fall" style={{ animationDelay: '0.7s' }}>💖</span>
          </div>
        </div>
      )}

      {gift.animationType === 'party' && (
        <div className="relative flex flex-col items-center">
          <div className="text-9xl animate-pulse drop-shadow-[0_10px_30px_rgba(130,50,250,0.7)]">
            🎉
          </div>
          <div className="absolute -inset-20 flex justify-between pointer-events-none">
            <span className="text-4xl animate-bounce">✨</span>
            <span className="text-4xl animate-ping">🎊</span>
            <span className="text-4xl animate-bounce">🎈</span>
            <span className="text-4xl animate-ping">🎆</span>
          </div>
        </div>
      )}

      {gift.animationType === 'teddy' && (
        <div className="relative flex flex-col items-center animate-bounce">
          <div className="text-9xl drop-shadow-[0_10px_25px_rgba(180,100,50,0.6)]">🧸</div>
          <div className="flex space-x-1 mt-2">
            <span className="text-2xl animate-ping">❤️</span>
            <span className="text-2xl animate-pulse">💖</span>
            <span className="text-2xl animate-ping">❤️</span>
          </div>
        </div>
      )}

      {gift.animationType === 'panda' && (
        <div className="relative flex flex-col items-center animate-bounce">
          <div className="text-9xl drop-shadow-[0_10px_25px_rgba(200,200,200,0.6)]">🐼</div>
          <div className="flex space-x-1 mt-2">
            <span className="text-2xl animate-pulse">🎋</span>
            <span className="text-2xl animate-ping">💖</span>
            <span className="text-2xl animate-pulse">🎋</span>
          </div>
        </div>
      )}

      {gift.animationType === 'rainbow' && (
        <div className="relative flex flex-col items-center animate-pulse">
          <div className="text-9xl drop-shadow-[0_10px_30px_rgba(0,200,255,0.7)]">🌈</div>
          <span className="text-4xl animate-bounce mt-2">✨ 🦄 ✨</span>
        </div>
      )}

      {gift.animationType === 'butterfly' && (
        <div className="relative flex flex-col items-center animate-bounce">
          <div className="text-9xl drop-shadow-[0_10px_25px_rgba(200,100,255,0.7)]">🦋</div>
          <span className="text-3xl animate-pulse mt-2">🌸 ✨ 🌸</span>
        </div>
      )}

      {gift.animationType === 'cake' && (
        <div className="relative flex flex-col items-center animate-bounce">
          <div className="text-9xl drop-shadow-[0_10px_25px_rgba(255,150,150,0.7)]">🎂</div>
          <span className="text-3xl animate-pulse mt-2">🎉 🍰 🕯️</span>
        </div>
      )}

      {gift.animationType === 'unicorn' && (
        <div className="relative flex flex-col items-center animate-pulse">
          <div className="text-9xl drop-shadow-[0_10px_30px_rgba(255,100,200,0.8)]">🦄</div>
          <span className="text-3xl animate-ping mt-2">✨ 💖 ✨</span>
        </div>
      )}

      {gift.animationType === 'star' && (
        <div className="relative flex flex-col items-center animate-spin-slow">
          <div className="text-9xl drop-shadow-[0_10px_30px_rgba(255,220,0,0.8)]">⭐</div>
          <span className="text-3xl animate-ping mt-2">🌟 🌟 🌟</span>
        </div>
      )}

      {gift.animationType === 'heart' && (
        <div className="relative flex flex-col items-center animate-pulse">
          <div className="text-9xl drop-shadow-[0_10px_30px_rgba(255,50,100,0.8)]">💖</div>
          <span className="text-3xl animate-ping mt-2">❤️ 💕 ❤️</span>
        </div>
      )}

      {gift.animationType === 'box' && (
        <div className="relative flex flex-col items-center animate-bounce">
          <div className="text-9xl drop-shadow-[0_10px_30px_rgba(255,100,50,0.7)]">🎁</div>
          <span className="text-3xl animate-ping mt-2">✨ 🎀 ✨</span>
        </div>
      )}
    </div>
  );
};
