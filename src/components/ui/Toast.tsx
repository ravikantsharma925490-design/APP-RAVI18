import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface ToastProps {
  type?: 'error' | 'success' | 'info';
  message: string;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type = 'info', message, onClose }) => {
  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 max-w-md animate-in slide-in-from-bottom-3',
        type === 'error' && 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
        type === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
        type === 'info' && 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
      )}
    >
      {type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
      {type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
      {type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
      <p className="text-sm font-medium leading-tight flex-1">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 opacity-70" />
        </button>
      )}
    </div>
  );
};
