import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  BellOff,
  Phone,
  MessageSquare,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { audioTones } from '@/src/lib/audio-tones';
import { notificationService } from '@/src/lib/notification-service';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [callSoundEnabled, setCallSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liveconnect_perm_call_sound') !== 'false';
    }
    return true;
  });

  const [msgSoundEnabled, setMsgSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liveconnect_perm_msg_sound') !== 'false';
    }
    return true;
  });

  const [pushNotifEnabled, setPushNotifEnabled] = useState<boolean>(() => {
    return notificationService.isPushEnabled();
  });

  const [browserPermission, setBrowserPermission] = useState<string>('default');
  const [isPlayingRingtone, setIsPlayingRingtone] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const checkStatus = () => {
    const perm = notificationService.getPermissionStatus();
    setBrowserPermission(perm);
    setPushNotifEnabled(notificationService.isPushEnabled());
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setStatusMessage(null);
    } else {
      if (isPlayingRingtone) {
        audioTones.stop();
        setIsPlayingRingtone(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle Call Ringtone
  const handleToggleCallSound = () => {
    const nextVal = !callSoundEnabled;
    setCallSoundEnabled(nextVal);
    localStorage.setItem('liveconnect_perm_call_sound', nextVal ? 'true' : 'false');
  };

  // Toggle Message Alert Sound
  const handleToggleMsgSound = () => {
    const nextVal = !msgSoundEnabled;
    setMsgSoundEnabled(nextVal);
    localStorage.setItem('liveconnect_perm_msg_sound', nextVal ? 'true' : 'false');
  };

  // Toggle Push Notifications
  const handleTogglePushNotif = async () => {
    setStatusMessage(null);

    if (pushNotifEnabled) {
      // Turn OFF
      notificationService.disablePush();
      setPushNotifEnabled(false);
      setStatusMessage({
        text: 'Push notifications have been turned OFF.',
        type: 'info',
      });
    } else {
      // Turn ON: request permission
      const granted = await notificationService.requestPermission();
      checkStatus();

      if (granted) {
        setPushNotifEnabled(true);
        setStatusMessage({
          text: 'Push notifications are now ON! You will receive incoming alerts.',
          type: 'success',
        });

        // Send confirmation test notification
        notificationService.sendNotification({
          title: '🔔 Push Notifications Active!',
          body: 'You will now receive instant alerts for incoming calls and messages.',
          icon: '/favicon.ico',
        });
      } else {
        const currentPerm = notificationService.getPermissionStatus();
        if (currentPerm === 'denied') {
          // Still enable in-app notifications so user never misses calls/messages!
          localStorage.setItem('liveconnect_perm_notif', 'true');
          setPushNotifEnabled(true);
          setStatusMessage({
            text: 'In-app Banner alerts are ON! To get desktop/system popups as well, click the lock 🔒 icon in the URL bar and change Notifications to "Allow".',
            type: 'info',
          });
          notificationService.sendNotification({
            title: '🔔 In-App Alerts Active',
            body: 'You will receive top screen alerts for calls & messages.',
            icon: '/favicon.ico',
          });
        } else {
          // If in iframe / preview fallback, enable in-app notifications
          localStorage.setItem('liveconnect_perm_notif', 'true');
          setPushNotifEnabled(true);
          setStatusMessage({
            text: 'In-app push notifications enabled! (Browser popups may require site permission).',
            type: 'success',
          });
          notificationService.sendNotification({
            title: '🔔 LiveConnect In-App Alerts Active',
            body: 'You will see notifications at the top of your screen.',
            icon: '/favicon.ico',
          });
        }
      }
    }
  };

  // Trigger Instant Test Push Notification
  const handleTestPushNotification = async () => {
    if (!pushNotifEnabled) {
      setStatusMessage({
        text: 'Pehle Push Notifications switch ko ON karein test karne ke liye.',
        type: 'info',
      });
      return;
    }

    const sent = await notificationService.sendNotification({
      title: '💬 Test LiveConnect Notification',
      body: 'Alex: Hey! Push notifications are working perfectly.',
      icon: '/favicon.ico',
    });

    if (sent) {
      setStatusMessage({
        text: 'Test Notification successfully sent! Dekhiye screen ke upar popup aagaya.',
        type: 'success',
      });
    }
  };

  // Test Ringtone Sound
  const toggleTestSound = () => {
    if (isPlayingRingtone) {
      audioTones.stop();
      setIsPlayingRingtone(false);
    } else {
      audioTones.startIncomingRingtone();
      setIsPlayingRingtone(true);
      setTimeout(() => {
        audioTones.stop();
        setIsPlayingRingtone(false);
      }, 4000);
    }
  };

  const testMessageChime = () => {
    audioTones.playMessageNotificationSound();
    setStatusMessage({
      text: 'Message chime sound played.',
      type: 'info',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
                Notification Settings
              </h3>
              <p className="text-xs text-neutral-500">
                Incoming call ringtones, message chimes & push alerts
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

        {/* Status Feedback Banner if any */}
        {statusMessage && (
          <div
            className={cn(
              'mx-5 mt-4 p-3 rounded-2xl border flex items-start gap-2.5 text-xs animate-in fade-in',
              statusMessage.type === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
              statusMessage.type === 'error' && 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
              statusMessage.type === 'info' && 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
            )}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {statusMessage.type === 'info' && <Info className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 font-bold ml-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Switches */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4">
          {/* 1. Push Notifications Toggle */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'p-2.5 rounded-2xl shrink-0 transition-colors',
                  pushNotifEnabled
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                )}
              >
                {pushNotifEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Push Notifications
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      pushNotifEnabled
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {pushNotifEnabled ? 'ON (Active)' : 'OFF (Disabled)'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  Popups and alerts for incoming calls & new messages
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={pushNotifEnabled}
              onClick={handleTogglePushNotif}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                pushNotifEnabled ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out',
                  pushNotifEnabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* 2. Incoming Call Ringtone */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'p-2.5 rounded-2xl shrink-0 transition-colors',
                  callSoundEnabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                )}
              >
                <Phone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Incoming Call Ringtone
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      callSoundEnabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {callSoundEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  Play musical ringtone for incoming calls
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={callSoundEnabled}
              onClick={handleToggleCallSound}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                callSoundEnabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out',
                  callSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* 3. Message Alert Sound */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'p-2.5 rounded-2xl shrink-0 transition-colors',
                  msgSoundEnabled
                    ? 'bg-purple-500/10 text-purple-500'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                )}
              >
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Message Alert Tone
                  </h4>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                      msgSoundEnabled
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {msgSoundEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                  Play gentle chime tone when new message arrives
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={msgSoundEnabled}
              onClick={handleToggleMsgSound}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                msgSoundEnabled ? 'bg-purple-600' : 'bg-neutral-300 dark:bg-neutral-700'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out',
                  msgSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* How to Unblock Guide */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
              <Info className="w-4 h-4 shrink-0" />
              <span>Browser Me Notification Kaise Allow Karein?</span>
            </div>
            <ul className="text-neutral-600 dark:text-neutral-300 space-y-1 pl-5 list-disc text-[11px] leading-relaxed">
              <li><strong>Mobile (Chrome)</strong>: Upar 3 dots (⋮) ➔ Site Settings ➔ Notifications ➔ <strong>Allow</strong> karein.</li>
              <li><strong>Computer / Laptop</strong>: URL bar me 🔒 lock icon par click karein ➔ Notifications ko <strong>"Allow"</strong> select karein.</li>
              <li>Agar browser popup block bhi ho, toh bhi <strong>In-App Screen Top Banner</strong> aur Ringtone 100% chalegi!</li>
            </ul>
          </div>

          {/* Test Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <h4 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Testing & Live Verification
            </h4>

            {/* Test Push Notification Button */}
            <button
              type="button"
              onClick={handleTestPushNotification}
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Send Test Push Notification Now</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleTestSound}
                className={cn(
                  'p-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer',
                  isPlayingRingtone
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-white dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                )}
              >
                <Volume2 className="w-4 h-4" />
                <span>{isPlayingRingtone ? 'Playing Ringtone...' : 'Test Ringtone'}</span>
              </button>

              <button
                type="button"
                onClick={testMessageChime}
                className="p-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <span>Test Message Chime</span>
              </button>
            </div>
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
