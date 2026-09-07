import { audioTones } from './audio-tones';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
  onClick?: () => void;
}

type NotificationListener = (payload: PushNotificationPayload) => void;

class NotificationService {
  private listeners: Set<NotificationListener> = new Set();
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initServiceWorker();
  }

  // Register service worker for modern browser & mobile push compatibility
  private async initServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.swRegistration = reg;
      } catch {
        // Fallback to standard Notification API
      }
    }
  }

  // Check current permission state
  getPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  // Check if push notifications are enabled in local storage
  isPushEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('liveconnect_perm_notif') === 'true';
  }

  // Request permission from browser
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!('Notification' in window)) {
      // If Notification API is not supported (some WebView/mobile environments),
      // we still enable in-app push notifications!
      localStorage.setItem('liveconnect_perm_notif', 'true');
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('liveconnect_perm_notif', 'true');
        return true;
      } else if (permission === 'denied') {
        // Browser explicitly blocked notifications
        localStorage.setItem('liveconnect_perm_notif', 'false');
        return false;
      } else {
        // Default / dismissed
        localStorage.setItem('liveconnect_perm_notif', 'false');
        return false;
      }
    } catch (err) {
      // In some iframe contexts, requestPermission throws. Enable in-app push as fallback.
      localStorage.setItem('liveconnect_perm_notif', 'true');
      return true;
    }
  }

  // Disable push notifications
  disablePush(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('liveconnect_perm_notif', 'false');
    }
  }

  // Send a push notification (both system/browser level and in-app heads-up)
  async sendNotification(payload: PushNotificationPayload): Promise<boolean> {
    const isEnabled = this.isPushEnabled();
    if (!isEnabled) {
      return false;
    }

    // 1. Play notification chime if message sound is enabled
    const isMsgSound = typeof window !== 'undefined' ? localStorage.getItem('liveconnect_perm_msg_sound') !== 'false' : true;
    if (isMsgSound) {
      audioTones.playMessageNotificationSound();
    }

    // 2. Trigger vibration on mobile if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // ignore
      }
    }

    // 3. Emit in-app Heads-up alert
    this.notifyInAppListeners(payload);

    // 4. Send native browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        // Try ServiceWorker first for mobile & desktop consistency
        if (this.swRegistration && 'showNotification' in this.swRegistration) {
          await this.swRegistration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/favicon.ico',
            badge: '/favicon.ico',
            tag: payload.tag || 'liveconnect-notification',
            data: payload.data,
          });
          return true;
        }

        // Fallback to standard new Notification
        const n = new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/favicon.ico',
          tag: payload.tag || 'liveconnect-notification',
          data: payload.data,
        });

        if (payload.onClick) {
          n.onclick = () => {
            window.focus();
            payload.onClick?.();
            n.close();
          };
        }

        return true;
      } catch (err) {
        console.warn('Native push notification error, fallback to in-app notification:', err);
      }
    }

    return true;
  }

  // Subscribe to in-app push banner notifications
  subscribeInApp(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyInAppListeners(payload: PushNotificationPayload) {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (e) {
        console.error('Error in in-app notification listener:', e);
      }
    });
  }
}

export const notificationService = new NotificationService();
