import React from 'react';
import { Settings2, Sparkles } from 'lucide-react';
import { getSupabaseConfig } from '@/src/lib/supabase/client';

interface ConfigBannerProps {
  onOpenConfig: () => void;
}

export const ConfigBanner: React.FC<ConfigBannerProps> = ({ onOpenConfig }) => {
  const supa = getSupabaseConfig();

  if (supa.isConfigured) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-purple-600/90 text-white px-4 py-2 text-xs flex items-center justify-between shadow-sm backdrop-blur-sm z-30 shrink-0">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
        <span className="font-medium">
          Connect your Supabase project credentials for real-time cloud chat persistence & authentication.
        </span>
      </div>
      <button
        onClick={onOpenConfig}
        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-all hover:scale-105 active:scale-95 shrink-0 ml-2 cursor-pointer"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Setup Supabase
      </button>
    </div>
  );
};
