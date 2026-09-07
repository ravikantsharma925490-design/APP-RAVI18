import React from 'react';

export const ConversationSkeleton: React.FC = () => {
  return (
    <div className="space-y-2 p-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse bg-neutral-100 dark:bg-neutral-800/40">
          <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
              <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-10" />
            </div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-36" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChatSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 min-h-[200px]">
      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-neutral-400 font-medium">Loading messages...</span>
    </div>
  );
};
