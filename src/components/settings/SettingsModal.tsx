import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Shield,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConfig?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  // User-controlled explicit toggle states (default OFF until user turns them ON)
  const [micEnabled, setMicEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liveconnect_perm_mic') === 'true';
    }
    return false;
  });

  const [camEnabled, setCamEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liveconnect_perm_cam') === 'true';
    }
    return false;
  });

  const [isTestingMedia, setIsTestingMedia] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsTestingMedia(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle Microphone
  const handleToggleMic = async () => {
    setErrorMessage(null);
    if (micEnabled) {
      setMicEnabled(false);
      localStorage.setItem('liveconnect_perm_mic', 'false');
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((t) => t.stop());
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicEnabled(true);
        localStorage.setItem('liveconnect_perm_mic', 'true');
      } catch (err: any) {
        setMicEnabled(false);
        localStorage.setItem('liveconnect_perm_mic', 'false');
        setErrorMessage('Microphone access was blocked or denied in browser settings.');
      }
    }
  };

  // Toggle Camera
  const handleToggleCam = async () => {
    setErrorMessage(null);
    if (camEnabled) {
      setCamEnabled(false);
      localStorage.setItem('liveconnect_perm_cam', 'false');
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => t.stop());
      }
      setIsTestingMedia(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        setCamEnabled(true);
        localStorage.setItem('liveconnect_perm_cam', 'true');
      } catch (err: any) {
        setCamEnabled(false);
        localStorage.setItem('liveconnect_perm_cam', 'false');
        setErrorMessage('Camera access was blocked or denied in browser settings.');
      }
    }
  };

  // Live Camera & Mic Test
  const toggleLiveMediaTest = async () => {
    if (isTestingMedia) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsTestingMedia(false);
      return;
    }

    if (!camEnabled && !micEnabled) {
      setErrorMessage('Pehle Camera ya Microphone switch ON karein test karne ke liye.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micEnabled,
        video: camEnabled,
      });
      streamRef.current = stream;
      setIsTestingMedia(true);

      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      setErrorMessage('Device test start nahi ho paya. Hardware connections check karein.');
      setIsTestingMedia(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
                Hardware Permissions
              </h3>
              <p className="text-xs text-neutral-500">
                Aapki marzi: Jo access ON rakhna ho wahi chalega
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Permissions Switches */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4">
          {/* Permission 1: Microphone */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'p-2.5 rounded-2xl shrink-0 transition-colors',
                  micEnabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                )}
              >
                {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Microphone Access
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      micEnabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {micEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  Used for voice and video calling
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={micEnabled}
              onClick={handleToggleMic}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                micEnabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out',
                  micEnabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* Permission 2: Camera */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'p-2.5 rounded-2xl shrink-0 transition-colors',
                  camEnabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                )}
              >
                {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Camera Access
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      camEnabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {camEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  Used for 1-on-1 HD video calling
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={camEnabled}
              onClick={handleToggleCam}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                camEnabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out',
                  camEnabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* Privacy Note */}
          <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Jab tak switch <strong>ON</strong> nahi hoga, tab tak browser hardware access nahi karega.
            </p>
          </div>

          {/* Hardware Live Test */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={toggleLiveMediaTest}
              disabled={!camEnabled && !micEnabled}
              className={cn(
                'w-full p-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                isTestingMedia
                  ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                  : 'bg-white dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-800 dark:text-neutral-200'
              )}
            >
              <Video className="w-4 h-4" />
              <span>{isTestingMedia ? 'Stop Live Preview' : 'Test Active Camera & Mic'}</span>
            </button>

            {/* Video preview box */}
            {isTestingMedia && camEnabled && (
              <div className="rounded-2xl overflow-hidden bg-black aspect-video relative border border-neutral-800 shadow-inner">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Feed Active
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
