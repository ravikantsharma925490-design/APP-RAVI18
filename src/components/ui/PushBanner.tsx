import React, { useState, useEffect } from 'react';
import { Bell, X, MessageSquare, Phone } from 'lucide-react';
import { notificationService, PushNotificationPayload } from '@/src/lib/notification-service';

export const PushBanner: React.FC = () => {
  const [currentNotification, setCurrentNotification] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribeInApp((payload) => {
      setCurrentNotification(payload);

      // Auto dismiss after 5 seconds
      const timer = setTimeout(() => {
        setCurrentNotification((prev) => (prev === payload ? null : prev));
      }, 5000);

      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!currentNotification) return null;

  const isCall = currentNotification.title.toLowerCase().includes('call');

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in slide-in-from-top-4 duration-300">
      <div
        onClick={() => {
          currentNotification.onClick?.();
          setCurrentNotification(null);
        }}
        className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all"
      >
        {/* Icon / Avatar */}
        <div className="relative shrink-0">
          {currentNotification.icon && currentNotification.icon.startsWith('http') ? (
            <img
              src={currentNotification.icon}
              alt=""
              className="w-10 h-10 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                isCall ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
            >
              {isCall ? <Phone className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 dark:bg-blue-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-white">
            <Bell className="w-2.5 h-2.5" />
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {currentNotification.title}
            </h4>
            <span className="text-[10px] text-neutral-400 font-medium shrink-0">Just now</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-1 mt-0.5">
            {currentNotification.body}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentNotification(null);
          }}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
