/**
 * Google AdMob Configuration
 *
 * Configured AdMob IDs:
 * AdMob App ID: ca-app-pub-4584671817749395~7447215874
 * AdMob Interstitial Ad Unit ID: ca-app-pub-4584671817749395/4409988993
 */

export const ADMOB_CONFIG = {
  // Configured AdMob App ID
  appId: 'ca-app-pub-4584671817749395~7447215874',

  // Configured AdMob Interstitial Ad Unit ID for Android post-call
  interstitialAdUnitId: 'ca-app-pub-4584671817749395/4409988993',

  // Environment variable override if specified
  envInterstitialAdUnitId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMOB_INTERSTITIAL_AD_UNIT_ID) || '',

  /**
   * Returns the active interstitial ad unit ID
   */
  getInterstitialAdUnitId(): string {
    const envId = this.envInterstitialAdUnitId.trim();
    if (envId && envId.startsWith('ca-app-pub-')) {
      return envId;
    }
    return this.interstitialAdUnitId;
  },

  /**
   * Test mode status
   */
  isTestMode(): boolean {
    return false;
  },
};
