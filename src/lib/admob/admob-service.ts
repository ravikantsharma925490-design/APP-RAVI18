import { Capacitor, registerPlugin } from '@capacitor/core';
import { ADMOB_CONFIG } from '@/src/config/admob';

interface AdMobInterstitialPluginInterface {
  initialize(options?: { testMode?: boolean }): Promise<{ success: boolean }>;
  loadInterstitial(options: { adUnitId: string }): Promise<{ success: boolean }>;
  showInterstitial(options?: { adUnitId?: string }): Promise<{ success: boolean; shown: boolean }>;
  isLoaded(): Promise<{ loaded: boolean }>;
}

// Register native AdMob Capacitor plugin with fallback
const AdMobNative = registerPlugin<AdMobInterstitialPluginInterface>('AdMobInterstitial', {
  web: () => ({
    initialize: async () => ({ success: true }),
    loadInterstitial: async () => ({ success: true }),
    showInterstitial: async () => ({ success: true, shown: false }),
    isLoaded: async () => ({ loaded: false }),
  }),
});

class AdMobService {
  private isInitialized = false;
  private isInitializing = false;
  private isLoading = false;
  // Set to store processed call IDs to prevent multiple ads from triggering on the same call
  private processedCallIds = new Set<string>();

  /**
   * Check if current platform is Android native Capacitor
   */
  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Initialize Google Mobile Ads SDK on native Android app startup and preload first ad
   */
  public async initialize(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }

    if (this.isInitialized || this.isInitializing) {
      return true;
    }

    this.isInitializing = true;

    try {
      const isTest = ADMOB_CONFIG.isTestMode();
      await AdMobNative.initialize({ testMode: isTest });
      this.isInitialized = true;
      this.isInitializing = false;

      // Preload first interstitial ad in the background
      this.preloadInterstitial();
      return true;
    } catch (err) {
      console.warn('[AdMob] Native initialization notice:', err);
      this.isInitializing = false;
      return false;
    }
  }

  /**
   * Preload an Interstitial Ad in background so it is ready when a call finishes
   */
  public async preloadInterstitial(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }

    if (this.isLoading) {
      return true;
    }

    this.isLoading = true;

    try {
      const adUnitId = ADMOB_CONFIG.getInterstitialAdUnitId();
      await AdMobNative.loadInterstitial({ adUnitId });
      this.isLoading = false;
      return true;
    } catch (err) {
      console.warn('[AdMob] Preload interstitial notice:', err);
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Check if an interstitial is loaded and ready
   */
  public async isAdReady(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }

    try {
      const result = await AdMobNative.isLoaded();
      return Boolean(result?.loaded);
    } catch {
      return false;
    }
  }

  /**
   * Show Google AdMob Interstitial Ad after a completed call
   *
   * @param callId Unique identifier of the call session
   * @param wasConnected Boolean indicating whether the call was actually connected
   */
  public async showPostCallInterstitial(callId: string, wasConnected: boolean): Promise<{ shown: boolean; reason?: string }> {
    // 1. Only execute on native Android app
    if (!this.isNativeAndroid()) {
      return { shown: false, reason: 'web_platform' };
    }

    // 2. Only show for completed/connected calls
    if (!wasConnected) {
      return { shown: false, reason: 'call_never_connected' };
    }

    // 3. Double-trigger protection: Ensure at most 1 ad per unique call ID
    if (!callId || this.processedCallIds.has(callId)) {
      return { shown: false, reason: 'already_triggered_for_this_call' };
    }

    // Mark as processed immediately
    this.processedCallIds.add(callId);

    // Keep processedCallIds bounded to prevent memory growth over long usage
    if (this.processedCallIds.size > 200) {
      const entries = Array.from(this.processedCallIds);
      this.processedCallIds = new Set(entries.slice(entries.length - 100));
    }

    try {
      // Ensure SDK is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      const adUnitId = ADMOB_CONFIG.getInterstitialAdUnitId();
      const res = await AdMobNative.showInterstitial({ adUnitId });

      // Automatically preload next interstitial in the background
      setTimeout(() => {
        this.preloadInterstitial();
      }, 1500);

      return { shown: Boolean(res?.shown) };
    } catch (err) {
      console.warn('[AdMob] Error displaying post-call interstitial ad:', err);
      // Try preloading for next call
      this.preloadInterstitial();
      return { shown: false, reason: 'ad_show_failed_or_not_ready' };
    }
  }
}

export const admobService = new AdMobService();
