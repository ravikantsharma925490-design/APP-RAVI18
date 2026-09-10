import React, { useEffect, useState } from 'react';
import { Wifi, AlertTriangle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface NetworkQualityIndicatorProps {
  quality?: 'excellent' | 'good' | 'poor';
}

export const NetworkQualityIndicator: React.FC<NetworkQualityIndicatorProps> = ({ quality }) => {
  const [showPoorWarning, setShowPoorWarning] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (quality === 'poor') {
      timer = setTimeout(() => {
        setShowPoorWarning(true);
      }, 10000);
    } else {
      setShowPoorWarning(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [quality]);

  if (!quality || quality === 'excellent') {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-2 animate-in fade-in zoom-in duration-300">
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-lg transition-all",
          quality === 'good' 
            ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
            : "bg-red-500/10 border-red-500/30 text-red-500"
        )}
      >
        <Wifi className="w-3.5 h-3.5" />
        <span>
          {quality === 'good' ? 'Network: Fair' : 'Poor Connection'}
        </span>
      </div>

      {showPoorWarning && (
        <div className="flex items-start gap-2 max-w-[220px] p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 backdrop-blur-md shadow-xl text-left animate-in slide-in-from-right-4 fade-in duration-300">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium text-red-300 leading-snug">
            Weak network detected — consider switching to audio only or moving closer to router.
          </p>
        </div>
      )}
    </div>
  );
};
