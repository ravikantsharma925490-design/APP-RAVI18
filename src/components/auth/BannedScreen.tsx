import React from 'react';

interface BannedScreenProps {
  bannedUntil: string | null;
}

export function BannedScreen({ bannedUntil }: BannedScreenProps) {
  const formattedDate = bannedUntil
    ? new Date(bannedUntil).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })
    : null;

  return (
    <div className="min-h-screen-safe w-full flex items-center justify-center p-4 bg-neutral-950 text-white">
      <div className="w-full max-w-md p-8 rounded-3xl bg-neutral-900/90 border border-red-900/50 shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-3xl">🚫</span>
        </div>
        <h1 className="text-2xl font-extrabold text-red-400">Account Banned</h1>
        <p className="text-sm text-neutral-300">
          Your LiveConnect account has been suspended for violating our
          Community Guidelines.
        </p>
        {formattedDate && (
          <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4">
            <p className="text-xs text-neutral-400 mb-1">Access restricted until</p>
            <p className="text-base font-bold text-white">{formattedDate}</p>
          </div>
        )}
        <p className="text-xs text-neutral-500">
          If you believe this is a mistake, please contact support.
        </p>
      </div>
    </div>
  );
}
