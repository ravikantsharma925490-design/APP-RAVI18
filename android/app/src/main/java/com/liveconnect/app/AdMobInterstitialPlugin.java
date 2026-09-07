package com.liveconnect.app;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.initialization.InitializationStatus;
import com.google.android.gms.ads.initialization.OnInitializationCompleteListener;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

@CapacitorPlugin(name = "AdMobInterstitial")
public class AdMobInterstitialPlugin extends Plugin {
    private static final String TAG = "AdMobInterstitialPlugin";
    private static final String DEFAULT_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-4584671817749395/4409988993";

    private InterstitialAd mInterstitialAd = null;
    private boolean isLoading = false;
    private boolean isSdkInitialized = false;
    private String lastAdUnitId = DEFAULT_INTERSTITIAL_AD_UNIT_ID;

    @PluginMethod
    public void initialize(final PluginCall call) {
        try {
            if (isSdkInitialized) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
                return;
            }

            MobileAds.initialize(getContext(), new OnInitializationCompleteListener() {
                @Override
                public void onInitializationComplete(@NonNull InitializationStatus initializationStatus) {
                    isSdkInitialized = true;
                    Log.d(TAG, "Google Mobile Ads SDK initialized successfully");
                    // Preload first interstitial ad
                    loadInternal(lastAdUnitId, null);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error initializing MobileAds SDK", e);
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void loadInterstitial(final PluginCall call) {
        String adUnitId = call.getString("adUnitId", DEFAULT_INTERSTITIAL_AD_UNIT_ID);
        if (adUnitId == null || adUnitId.trim().isEmpty()) {
            adUnitId = DEFAULT_INTERSTITIAL_AD_UNIT_ID;
        }
        this.lastAdUnitId = adUnitId;
        loadInternal(adUnitId, call);
    }

    private synchronized void loadInternal(final String adUnitId, final PluginCall call) {
        if (mInterstitialAd != null) {
            Log.d(TAG, "Interstitial ad already ready in memory");
            if (call != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("loaded", true);
                call.resolve(ret);
            }
            return;
        }

        if (isLoading) {
            Log.d(TAG, "Interstitial ad already loading");
            if (call != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("loading", true);
                call.resolve(ret);
            }
            return;
        }

        isLoading = true;

        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                try {
                    AdRequest adRequest = new AdRequest.Builder().build();
                    InterstitialAd.load(
                        getContext(),
                        adUnitId,
                        adRequest,
                        new InterstitialAdLoadCallback() {
                            @Override
                            public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                                mInterstitialAd = interstitialAd;
                                isLoading = false;
                                Log.d(TAG, "Interstitial Ad loaded successfully");
                                if (call != null) {
                                    JSObject ret = new JSObject();
                                    ret.put("success", true);
                                    ret.put("loaded", true);
                                    call.resolve(ret);
                                }
                            }

                            @Override
                            public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                                mInterstitialAd = null;
                                isLoading = false;
                                Log.w(TAG, "Interstitial Ad failed to load: " + loadAdError.getMessage());
                                if (call != null) {
                                    JSObject ret = new JSObject();
                                    ret.put("success", false);
                                    ret.put("error", loadAdError.getMessage());
                                    call.resolve(ret);
                                }
                            }
                        }
                    );
                } catch (Exception e) {
                    isLoading = false;
                    Log.e(TAG, "Exception during InterstitialAd.load", e);
                    if (call != null) {
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", e.getMessage());
                        call.resolve(ret);
                    }
                }
            }
        });
    }

    @PluginMethod
    public void isLoaded(final PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("loaded", mInterstitialAd != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void showInterstitial(final PluginCall call) {
        if (mInterstitialAd == null) {
            Log.d(TAG, "Interstitial Ad is not ready yet, requesting background load");
            String adUnitId = call.getString("adUnitId", lastAdUnitId);
            loadInternal(adUnitId, null);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("shown", false);
            ret.put("reason", "ad_not_ready");
            call.resolve(ret);
            return;
        }

        final InterstitialAd adToShow = mInterstitialAd;

        adToShow.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                Log.d(TAG, "Interstitial Ad dismissed by user, preloading next ad");
                mInterstitialAd = null;
                preloadNextAd();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError adError) {
                Log.w(TAG, "Interstitial Ad failed to show: " + adError.getMessage());
                mInterstitialAd = null;
                preloadNextAd();
            }

            @Override
            public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Interstitial Ad showed full screen content");
                mInterstitialAd = null;
            }
        });

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    adToShow.show(getActivity());
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("shown", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "Exception while showing interstitial ad", e);
                    mInterstitialAd = null;
                    preloadNextAd();
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("shown", false);
                    ret.put("error", e.getMessage());
                    call.resolve(ret);
                }
            }
        });
    }

    private void preloadNextAd() {
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                loadInternal(lastAdUnitId, null);
            }
        }, 1500);
    }
}
