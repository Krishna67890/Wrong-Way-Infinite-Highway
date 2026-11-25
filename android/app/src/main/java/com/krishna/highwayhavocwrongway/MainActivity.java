package com.krishna.highwayhavocwrongway;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;

import org.json.JSONObject;

import java.util.Collections;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "HighwayHavocAds";
    // AdMob App ID (also declared in AndroidManifest.xml): ca-app-pub-1889923922299467~6416515245
    private static final String ADMOB_AD_UNIT_ID = "ca-app-pub-1889923922299467/9972616872";
    private static final String ADMOB_BANNER_UNIT_ID = "ca-app-pub-1889923922299467/1825467880";
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String ENTRY_URL = "https://" + APP_HOST + "/index.html";
    private static final String PREFS_ADS = "HighwayHavocAdPrefs";
    private static final String KEY_CACHED_FORMAT = "cached_ad_format_v3";

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private LinearLayout rootContainer;
    private FrameLayout anchoredBannerSlot;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private SharedPreferences adPrefs;

    private RewardedAd rewardedAd;
    private RewardedInterstitialAd rewardedInterstitialAd;
    private InterstitialAd interstitialAd;
    private AppOpenAd appOpenAd;
    private AdView mrecFallbackAdView;
    private AdView dockedBannerAdView;

    private boolean adsInitialized = false;
    private boolean isLoadingAd = false;
    private boolean isShowingAd = false;
    private boolean rewardEarnedInSession = false;
    private boolean gameplayActive = false;
    private boolean mrecFallbackLoaded = false;
    private boolean dockedBannerLoaded = false;
    private String lastAdError = "";
    private String detectedFormat = "INITIALIZING";
    private String cachedFormat = "";
    private String pendingShowPurpose = null;
    private Dialog loadingWaitDialog = null;
    private Dialog sponsoredAdDialog = null;
    private CountDownTimer sponsoredAdTimer = null;

    private final Runnable bannerRetryRunnable = this::mountDockedAdaptiveBanner;
    private final Runnable watchAdRetryRunnable = this::preloadWatchAds;
    private final Runnable pendingWaitTimeoutRunnable = this::onPendingAdWaitTimeout;

    @SuppressLint({"SetJavaScriptEnabled", "SourceLockedOrientationActivity"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        adPrefs = getSharedPreferences(PREFS_ADS, MODE_PRIVATE);
        cachedFormat = adPrefs.getString(KEY_CACHED_FORMAT, "");

        // Allow responsive portrait + landscape across all Android phones, foldables, and tablets
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enableFullscreenImmersive();

        rootContainer = new LinearLayout(this);
        rootContainer.setOrientation(LinearLayout.VERTICAL);
        rootContainer.setBackgroundColor(Color.parseColor("#080A0F"));
        rootContainer.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        LinearLayout.LayoutParams webParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1.0f
        );
        webView.setLayoutParams(webParams);
        webView.setBackgroundColor(Color.parseColor("#080A0F"));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        anchoredBannerSlot = new FrameLayout(this);
        LinearLayout.LayoutParams bannerSlotParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        anchoredBannerSlot.setLayoutParams(bannerSlotParams);
        anchoredBannerSlot.setBackgroundColor(Color.parseColor("#080A0F"));
        anchoredBannerSlot.setVisibility(View.GONE);

        rootContainer.addView(webView);
        rootContainer.addView(anchoredBannerSlot);
        setContentView(rootContainer);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Serve / -> assets/public/ so root-relative /assets/... imports resolve cleanly
        WebViewAssetLoader.AssetsPathHandler publicHandler =
                new WebViewAssetLoader.AssetsPathHandler(this);
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(APP_HOST)
                .addPathHandler("/", path -> {
                    String normalized = (path == null || path.isEmpty() || "/".equals(path))
                            ? "index.html"
                            : (path.startsWith("/") ? path.substring(1) : path);
                    if (normalized.endsWith("/")) {
                        normalized = normalized + "index.html";
                    }
                    WebResourceResponse response = publicHandler.handle("public/" + normalized);
                    if (response == null && !normalized.contains(".")) {
                        response = publicHandler.handle("public/index.html");
                    }
                    return response;
                })
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (!url.contains("appassets.androidplatform.net")) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            startActivity(intent);
                            return true;
                        } catch (Exception e) {
                            Log.e(TAG, "Error opening external link: " + e.getMessage());
                        }
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            @Nullable
            public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request
            ) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            @Nullable
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidAdsBridge(), "AndroidAdsBridge");

        RequestConfiguration requestConfig = new RequestConfiguration.Builder()
                .setTestDeviceIds(Collections.emptyList())
                .build();
        MobileAds.setRequestConfiguration(requestConfig);

        MobileAds.initialize(this, initializationStatus -> {
            Log.d(TAG, "AdMob initialized: " + initializationStatus.getAdapterStatusMap());
            adsInitialized = true;
            mountDockedAdaptiveBanner();
            preloadWatchAds();
        });

        webView.loadUrl(ENTRY_URL);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        enableFullscreenImmersive();
        mainHandler.postDelayed(() -> {
            if (adsInitialized) {
                mountDockedAdaptiveBanner();
            }
        }, 180);
    }

    private void enableFullscreenImmersive() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
    }

    private boolean hasFullscreenAdLoaded() {
        return rewardedAd != null
                || rewardedInterstitialAd != null
                || interstitialAd != null
                || appOpenAd != null;
    }

    private boolean hasLoadedAd() {
        return hasFullscreenAdLoaded()
                || (mrecFallbackAdView != null && mrecFallbackLoaded);
    }

    private void saveDetectedFormat(String format) {
        detectedFormat = format;
        cachedFormat = format;
        if (adPrefs != null) {
            adPrefs.edit().putString(KEY_CACHED_FORMAT, format).apply();
        }
    }

    private void scheduleWatchAdRetry() {
        mainHandler.removeCallbacks(watchAdRetryRunnable);
        mainHandler.postDelayed(watchAdRetryRunnable, 15000);
    }

    /**
     * Loads fullscreen Watch Ad inventory from ADMOB_AD_UNIT_ID.
     */
    private void preloadWatchAds() {
        mainHandler.removeCallbacks(watchAdRetryRunnable);
        if (!adsInitialized || isLoadingAd || hasFullscreenAdLoaded()) return;
        isLoadingAd = true;
        lastAdError = "";

        if ("REWARDED".equals(cachedFormat)) {
            loadSingleRewarded(true);
            return;
        }
        if ("REWARDED_INTERSTITIAL".equals(cachedFormat)) {
            loadSingleRewardedInterstitial(true);
            return;
        }
        if ("INTERSTITIAL".equals(cachedFormat)) {
            loadSingleInterstitial(true);
            return;
        }
        if ("APP_OPEN".equals(cachedFormat)) {
            loadSingleAppOpen(true);
            return;
        }

        probeWatchFormatsInParallel();
    }

    private void probeWatchFormatsInParallel() {
        final int totalProbes = 5;
        final AtomicInteger remainingFailures = new AtomicInteger(totalProbes);

        Runnable onProbeFailed = () -> {
            if (remainingFailures.decrementAndGet() == 0 && !hasLoadedAd()) {
                isLoadingAd = false;
                detectedFormat = "NO_FILL";
                cachedFormat = "";
                scheduleWatchAdRetry();
                if (pendingShowPurpose != null && !isShowingAd) {
                    mainHandler.removeCallbacks(pendingWaitTimeoutRunnable);
                    dismissLoadingWaitDialog();
                    String purpose = pendingShowPurpose;
                    pendingShowPurpose = null;
                    showAdMobOverlayDialog(purpose, null);
                }
            }
        };

        // 1. Rewarded
        RewardedAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                rewardedAd = ad;
                isLoadingAd = false;
                lastAdError = "";
                saveDetectedFormat("REWARDED");
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                Log.w(TAG, "Rewarded load failed (" + err.getCode() + "): " + err.getMessage());
                if (lastAdError.isEmpty()) lastAdError = err.getCode() + ": " + err.getMessage();
                onProbeFailed.run();
            }
        });

        // 2. Rewarded Interstitial
        RewardedInterstitialAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new RewardedInterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedInterstitialAd ad) {
                rewardedInterstitialAd = ad;
                isLoadingAd = false;
                lastAdError = "";
                if (!"REWARDED".equals(detectedFormat)) {
                    saveDetectedFormat("REWARDED_INTERSTITIAL");
                }
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                Log.w(TAG, "RewardedInt load failed (" + err.getCode() + "): " + err.getMessage());
                if (lastAdError.isEmpty()) lastAdError = err.getCode() + ": " + err.getMessage();
                onProbeFailed.run();
            }
        });

        // 3. Interstitial
        InterstitialAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull InterstitialAd ad) {
                interstitialAd = ad;
                isLoadingAd = false;
                lastAdError = "";
                if (!"REWARDED".equals(detectedFormat) && !"REWARDED_INTERSTITIAL".equals(detectedFormat)) {
                    saveDetectedFormat("INTERSTITIAL");
                }
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                Log.w(TAG, "Interstitial load failed (" + err.getCode() + "): " + err.getMessage());
                if (lastAdError.isEmpty()) lastAdError = err.getCode() + ": " + err.getMessage();
                onProbeFailed.run();
            }
        });

        // 4. App Open (4-arg API for Play Services Ads 23.3+)
        AppOpenAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new AppOpenAd.AppOpenAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull AppOpenAd ad) {
                appOpenAd = ad;
                isLoadingAd = false;
                lastAdError = "";
                if (rewardedAd == null && rewardedInterstitialAd == null && interstitialAd == null) {
                    saveDetectedFormat("APP_OPEN");
                }
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                Log.w(TAG, "AppOpen load failed (" + err.getCode() + "): " + err.getMessage());
                if (lastAdError.isEmpty()) lastAdError = err.getCode() + ": " + err.getMessage();
                onProbeFailed.run();
            }
        });

        // 5. MREC fallback on ADMOB_AD_UNIT_ID
        final AdView candidate = new AdView(this);
        candidate.setAdUnitId(ADMOB_AD_UNIT_ID);
        candidate.setAdSize(AdSize.MEDIUM_RECTANGLE);
        candidate.setAdListener(new AdListener() {
            @Override
            public void onAdLoaded() {
                if (mrecFallbackAdView != null) {
                    mrecFallbackAdView.destroy();
                }
                mrecFallbackAdView = candidate;
                mrecFallbackLoaded = true;
                isLoadingAd = false;
                lastAdError = "";
                if (pendingShowPurpose != null && !isShowingAd && !hasFullscreenAdLoaded()) {
                    mainHandler.removeCallbacks(pendingWaitTimeoutRunnable);
                    dismissLoadingWaitDialog();
                    String p = pendingShowPurpose;
                    pendingShowPurpose = null;
                    presentLoadedAd(p);
                }
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                candidate.destroy();
                Log.w(TAG, "MREC fallback failed (" + err.getCode() + "): " + err.getMessage());
                if (lastAdError.isEmpty()) lastAdError = err.getCode() + ": " + err.getMessage();
                onProbeFailed.run();
            }
        });
        candidate.loadAd(new AdRequest.Builder().build());
    }

    private void loadSingleRewarded(boolean fallbackToParallelOnFail) {
        RewardedAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedAd ad) {
                rewardedAd = ad;
                isLoadingAd = false;
                detectedFormat = "REWARDED";
                lastAdError = "";
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                rewardedAd = null;
                lastAdError = "Rewarded " + err.getCode() + ": " + err.getMessage();
                if (fallbackToParallelOnFail) {
                    cachedFormat = "";
                    probeWatchFormatsInParallel();
                } else {
                    isLoadingAd = false;
                    scheduleWatchAdRetry();
                }
            }
        });
    }

    private void loadSingleRewardedInterstitial(boolean fallbackToParallelOnFail) {
        RewardedInterstitialAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new RewardedInterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull RewardedInterstitialAd ad) {
                rewardedInterstitialAd = ad;
                isLoadingAd = false;
                detectedFormat = "REWARDED_INTERSTITIAL";
                lastAdError = "";
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                rewardedInterstitialAd = null;
                lastAdError = "RewardedInt " + err.getCode() + ": " + err.getMessage();
                if (fallbackToParallelOnFail) {
                    cachedFormat = "";
                    probeWatchFormatsInParallel();
                } else {
                    isLoadingAd = false;
                    scheduleWatchAdRetry();
                }
            }
        });
    }

    private void loadSingleInterstitial(boolean fallbackToParallelOnFail) {
        InterstitialAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull InterstitialAd ad) {
                interstitialAd = ad;
                isLoadingAd = false;
                detectedFormat = "INTERSTITIAL";
                lastAdError = "";
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                interstitialAd = null;
                lastAdError = "Interstitial " + err.getCode() + ": " + err.getMessage();
                if (fallbackToParallelOnFail) {
                    cachedFormat = "";
                    probeWatchFormatsInParallel();
                } else {
                    isLoadingAd = false;
                    scheduleWatchAdRetry();
                }
            }
        });
    }

    private void loadSingleAppOpen(boolean fallbackToParallelOnFail) {
        AppOpenAd.load(this, ADMOB_AD_UNIT_ID, new AdRequest.Builder().build(), new AppOpenAd.AppOpenAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull AppOpenAd ad) {
                appOpenAd = ad;
                isLoadingAd = false;
                detectedFormat = "APP_OPEN";
                lastAdError = "";
                deliverPendingShowIfWaiting();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                appOpenAd = null;
                lastAdError = "AppOpen " + err.getCode() + ": " + err.getMessage();
                if (fallbackToParallelOnFail) {
                    cachedFormat = "";
                    probeWatchFormatsInParallel();
                } else {
                    isLoadingAd = false;
                    scheduleWatchAdRetry();
                }
            }
        });
    }

    private AdSize getAdaptiveBannerSize() {
        DisplayMetrics outMetrics = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getMetrics(outMetrics);
        float widthPixels = outMetrics.widthPixels;
        float density = outMetrics.density <= 0 ? 1f : outMetrics.density;
        int adWidthDp = Math.max(320, (int) (widthPixels / density));
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, adWidthDp);
    }

    private void mountDockedAdaptiveBanner() {
        mainHandler.removeCallbacks(bannerRetryRunnable);
        if (!adsInitialized) return;

        if (dockedBannerAdView != null) {
            anchoredBannerSlot.removeAllViews();
            dockedBannerAdView.destroy();
            dockedBannerAdView = null;
        }
        dockedBannerLoaded = false;
        updateAnchoredBannerVisibility();

        final AdView banner = new AdView(this);
        banner.setAdUnitId(ADMOB_BANNER_UNIT_ID);
        banner.setAdSize(getAdaptiveBannerSize());
        banner.setAdListener(new AdListener() {
            @Override
            public void onAdLoaded() {
                if (dockedBannerAdView != banner) return;
                dockedBannerLoaded = true;
                Log.d(TAG, "Docked Banner loaded successfully");
                updateAnchoredBannerVisibility();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError err) {
                Log.w(TAG, "Docked Banner load failed (" + err.getCode() + "): " + err.getMessage());
                if (dockedBannerAdView == banner) {
                    dockedBannerLoaded = false;
                    updateAnchoredBannerVisibility();
                    mainHandler.postDelayed(bannerRetryRunnable, 15000);
                }
            }
        });

        dockedBannerAdView = banner;
        anchoredBannerSlot.addView(banner);
        banner.loadAd(new AdRequest.Builder().build());
    }

    private void updateAnchoredBannerVisibility() {
        if (dockedBannerAdView == null || !dockedBannerLoaded || gameplayActive) {
            anchoredBannerSlot.setVisibility(View.GONE);
        } else {
            anchoredBannerSlot.setVisibility(View.VISIBLE);
        }
    }

    private void deliverPendingShowIfWaiting() {
        if (pendingShowPurpose != null && !isShowingAd && hasFullscreenAdLoaded()) {
            mainHandler.removeCallbacks(pendingWaitTimeoutRunnable);
            dismissLoadingWaitDialog();
            String p = pendingShowPurpose;
            pendingShowPurpose = null;
            presentLoadedAd(p);
        }
    }

    private void onPendingAdWaitTimeout() {
        dismissLoadingWaitDialog();
        if (pendingShowPurpose == null || isShowingAd) return;
        String purpose = pendingShowPurpose;
        pendingShowPurpose = null;
        if (hasLoadedAd()) {
            presentLoadedAd(purpose);
        } else {
            showAdMobOverlayDialog(purpose, null);
        }
    }

    private void showLoadingWaitDialog(String purpose) {
        dismissLoadingWaitDialog();
        pendingShowPurpose = purpose;

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(false);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#E6080C15")));
        }

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(56, 48, 56, 48);

        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminate(true);
        box.addView(spinner);

        TextView msg = new TextView(this);
        msg.setText("Loading Ad...");
        msg.setTextColor(Color.WHITE);
        msg.setTextSize(15);
        msg.setGravity(Gravity.CENTER);
        msg.setPadding(0, 24, 0, 0);
        box.addView(msg);

        dialog.setContentView(box);
        loadingWaitDialog = dialog;
        dialog.show();

        preloadWatchAds();
        mainHandler.removeCallbacks(pendingWaitTimeoutRunnable);
        mainHandler.postDelayed(pendingWaitTimeoutRunnable, 3000);
    }

    private void dismissLoadingWaitDialog() {
        if (loadingWaitDialog != null) {
            try {
                if (loadingWaitDialog.isShowing()) {
                    loadingWaitDialog.dismiss();
                }
            } catch (Exception ignored) {
            }
            loadingWaitDialog = null;
        }
    }

    private void presentLoadedAd(String purpose) {
        if (isShowingAd) return;

        if (rewardedAd != null) {
            final RewardedAd ad = rewardedAd;
            rewardedAd = null;
            isShowingAd = true;
            rewardEarnedInSession = false;

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    isShowingAd = false;
                    notifyAdComplete(
                            purpose,
                            rewardEarnedInSession,
                            rewardEarnedInSession
                                    ? "Reward earned!"
                                    : "Watch the full ad to claim your reward."
                    );
                    preloadWatchAds();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError err) {
                    isShowingAd = false;
                    showAdMobOverlayDialog(purpose, null);
                    preloadWatchAds();
                }
            });

            ad.show(this, rewardItem -> rewardEarnedInSession = true);
            return;
        }

        if (rewardedInterstitialAd != null) {
            final RewardedInterstitialAd ad = rewardedInterstitialAd;
            rewardedInterstitialAd = null;
            isShowingAd = true;
            rewardEarnedInSession = false;

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    isShowingAd = false;
                    notifyAdComplete(
                            purpose,
                            rewardEarnedInSession,
                            rewardEarnedInSession
                                    ? "Reward earned!"
                                    : "Watch the full ad to claim your reward."
                    );
                    preloadWatchAds();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError err) {
                    isShowingAd = false;
                    showAdMobOverlayDialog(purpose, null);
                    preloadWatchAds();
                }
            });

            ad.show(this, rewardItem -> rewardEarnedInSession = true);
            return;
        }

        if (interstitialAd != null) {
            final InterstitialAd ad = interstitialAd;
            interstitialAd = null;
            isShowingAd = true;
            rewardEarnedInSession = false;

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    rewardEarnedInSession = true;
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    isShowingAd = false;
                    notifyAdComplete(
                            purpose,
                            rewardEarnedInSession,
                            rewardEarnedInSession ? "Reward earned!" : "Ad closed."
                    );
                    preloadWatchAds();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError err) {
                    isShowingAd = false;
                    showAdMobOverlayDialog(purpose, null);
                    preloadWatchAds();
                }
            });

            ad.show(this);
            return;
        }

        if (appOpenAd != null) {
            final AppOpenAd ad = appOpenAd;
            appOpenAd = null;
            isShowingAd = true;
            rewardEarnedInSession = false;

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    rewardEarnedInSession = true;
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    isShowingAd = false;
                    notifyAdComplete(
                            purpose,
                            rewardEarnedInSession,
                            rewardEarnedInSession ? "Reward earned!" : "Ad closed."
                    );
                    preloadWatchAds();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError err) {
                    isShowingAd = false;
                    showAdMobOverlayDialog(purpose, null);
                    preloadWatchAds();
                }
            });

            ad.show(this);
            return;
        }

        if (mrecFallbackAdView != null && mrecFallbackLoaded) {
            AdView readyView = mrecFallbackAdView;
            mrecFallbackAdView = null;
            mrecFallbackLoaded = false;
            showAdMobOverlayDialog(purpose, readyView);
            return;
        }

        // Wait up to 3s for real AdMob full-screen ad to load; if still unavailable, show AdMob Banner / Sponsored Promo
        showLoadingWaitDialog(purpose);
    }

    private void showAdMobOverlayDialog(String purpose, @Nullable AdView preloadedAdView) {
        if (isShowingAd) return;
        isShowingAd = true;

        final AdView adViewToShow;
        if (preloadedAdView != null) {
            if (preloadedAdView.getParent() instanceof ViewGroup) {
                ((ViewGroup) preloadedAdView.getParent()).removeView(preloadedAdView);
            }
            adViewToShow = preloadedAdView;
        } else {
            adViewToShow = new AdView(this);
            adViewToShow.setAdUnitId(ADMOB_BANNER_UNIT_ID);
            adViewToShow.setAdSize(AdSize.MEDIUM_RECTANGLE);
        }

        Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCancelable(false);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#F2080C15")));
        }

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(36, 36, 36, 36);

        TextView header = new TextView(this);
        header.setText("SPONSORED REWARD");
        header.setTextColor(Color.parseColor("#FBBF24"));
        header.setTextSize(16);
        header.setGravity(Gravity.CENTER);
        header.setPadding(0, 0, 0, 6);
        layout.addView(header);

        TextView subHeader = new TextView(this);
        String rewardLabel = "free_revive".equals(purpose)
                ? "Watch to revive back onto the highway"
                : "double_coins".equals(purpose)
                    ? "Watch to double all coins from this run"
                    : "Watch to unlock +500 garage coins";
        subHeader.setText(rewardLabel);
        subHeader.setTextColor(Color.parseColor("#CBD5E1"));
        subHeader.setTextSize(13);
        subHeader.setGravity(Gravity.CENTER);
        subHeader.setPadding(0, 0, 0, 18);
        layout.addView(subHeader);

        FrameLayout adContainer = new FrameLayout(this);
        adContainer.setBackgroundColor(Color.parseColor("#0F172A"));
        adContainer.setPadding(8, 8, 8, 8);
        LinearLayout.LayoutParams adContainerParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        adContainerParams.gravity = Gravity.CENTER_HORIZONTAL;

        LinearLayout fallbackShowcase = new LinearLayout(this);
        fallbackShowcase.setOrientation(LinearLayout.VERTICAL);
        fallbackShowcase.setGravity(Gravity.CENTER);
        fallbackShowcase.setPadding(32, 32, 32, 32);

        TextView promoTitle = new TextView(this);
        promoTitle.setText("FIRE CHIEF INTERCEPTOR & SUPERCAR FLEET");
        promoTitle.setTextColor(Color.parseColor("#38BDF8"));
        promoTitle.setTextSize(14);
        promoTitle.setGravity(Gravity.CENTER);
        fallbackShowcase.addView(promoTitle);

        TextView promoBody = new TextView(this);
        promoBody.setText("Unlock Emergency Ambulances, Police Cruisers, Fire Brigade Engines & 350+ km/h Hypercars in the Garage!");
        promoBody.setTextColor(Color.parseColor("#E2E8F0"));
        promoBody.setTextSize(12);
        promoBody.setGravity(Gravity.CENTER);
        promoBody.setPadding(0, 12, 0, 0);
        fallbackShowcase.addView(promoBody);

        adContainer.addView(fallbackShowcase);
        adContainer.addView(adViewToShow);

        if (preloadedAdView == null) {
            adViewToShow.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    fallbackShowcase.setVisibility(View.GONE);
                }
            });
            adViewToShow.loadAd(new AdRequest.Builder().build());
        } else {
            fallbackShowcase.setVisibility(View.GONE);
        }

        layout.addView(adContainer, adContainerParams);

        Button claimBtn = new Button(this);
        claimBtn.setText("REWARD IN 5s...");
        claimBtn.setEnabled(false);
        claimBtn.setBackgroundColor(Color.parseColor("#1E293B"));
        claimBtn.setTextColor(Color.WHITE);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        btnParams.topMargin = 22;
        layout.addView(claimBtn, btnParams);

        Button cancelBtn = new Button(this);
        cancelBtn.setText("CLOSE AD");
        cancelBtn.setBackgroundColor(Color.TRANSPARENT);
        cancelBtn.setTextColor(Color.parseColor("#94A3B8"));
        LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cancelParams.topMargin = 8;
        layout.addView(cancelBtn, cancelParams);

        dialog.setContentView(layout);
        sponsoredAdDialog = dialog;
        dialog.show();

        final boolean[] completed = {false};
        if (sponsoredAdTimer != null) {
            sponsoredAdTimer.cancel();
        }
        sponsoredAdTimer = new CountDownTimer(5000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                long sec = (millisUntilFinished + 999) / 1000;
                claimBtn.setText("REWARD IN " + sec + "s");
            }

            @Override
            public void onFinish() {
                completed[0] = true;
                claimBtn.setEnabled(true);
                claimBtn.setBackgroundColor(Color.parseColor("#10B981"));
                claimBtn.setTextColor(Color.parseColor("#020617"));
                claimBtn.setText("CLAIM REWARD & CLOSE");
            }
        };
        sponsoredAdTimer.start();

        View.OnClickListener closeHandler = v -> {
            boolean grant = (v == claimBtn) && completed[0];
            if (sponsoredAdTimer != null) {
                sponsoredAdTimer.cancel();
                sponsoredAdTimer = null;
            }
            if (dialog.isShowing()) {
                dialog.dismiss();
            }
            adViewToShow.destroy();
            sponsoredAdDialog = null;
            isShowingAd = false;
            notifyAdComplete(
                    purpose,
                    grant,
                    grant ? "Reward earned!" : "Ad closed before reward unlocked."
            );
            preloadWatchAds();
        };

        claimBtn.setOnClickListener(closeHandler);
        cancelBtn.setOnClickListener(closeHandler);
    }

    private void notifyAdComplete(String purpose, boolean granted, String message) {
        mainHandler.post(() -> {
            if (webView == null) return;
            String safePurpose = JSONObject.quote(purpose == null ? "" : purpose);
            String safeMsg = JSONObject.quote(message == null ? "" : message);
            String js = "window.__onAndroidAdComplete && window.__onAndroidAdComplete("
                    + safePurpose + "," + (granted ? "true" : "false") + "," + safeMsg + ");";
            webView.evaluateJavascript(js, null);
        });
    }

    public class AndroidAdsBridge {
        @JavascriptInterface
        public boolean isAdReady() {
            return true;
        }

        @JavascriptInterface
        public String getLastError() {
            return lastAdError;
        }

        @JavascriptInterface
        public String getDetectedFormat() {
            return detectedFormat;
        }

        @JavascriptInterface
        public void preloadAd() {
            mainHandler.post(() -> preloadWatchAds());
        }

        @JavascriptInterface
        public void setGameplayActive(boolean active) {
            mainHandler.post(() -> {
                gameplayActive = active;
                updateAnchoredBannerVisibility();
            });
        }

        @JavascriptInterface
        public void showAd(String purpose) {
            mainHandler.post(() -> {
                if (isShowingAd) {
                    notifyAdComplete(purpose, false, "Another ad is currently open.");
                    return;
                }
                presentLoadedAd(purpose);
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
        if (dockedBannerAdView != null) {
            dockedBannerAdView.resume();
        }
        enableFullscreenImmersive();
    }

    @Override
    protected void onPause() {
        if (dockedBannerAdView != null) {
            dockedBannerAdView.pause();
        }
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableFullscreenImmersive();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(bannerRetryRunnable);
        mainHandler.removeCallbacks(watchAdRetryRunnable);
        mainHandler.removeCallbacks(pendingWaitTimeoutRunnable);
        dismissLoadingWaitDialog();
        if (sponsoredAdTimer != null) {
            sponsoredAdTimer.cancel();
            sponsoredAdTimer = null;
        }
        if (sponsoredAdDialog != null && sponsoredAdDialog.isShowing()) {
            sponsoredAdDialog.dismiss();
        }
        if (mrecFallbackAdView != null) {
            mrecFallbackAdView.destroy();
        }
        if (dockedBannerAdView != null) {
            dockedBannerAdView.destroy();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
