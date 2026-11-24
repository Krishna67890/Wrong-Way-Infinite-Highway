package com.krishna.highwayhavocwrongway;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd;
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "HighwayHavocAds";
    private static final String ADMOB_AD_UNIT_ID = "ca-app-pub-1889923922299467/9972616872";

    private enum DetectedFormat {
        UNKNOWN,
        REWARDED,
        REWARDED_INTERSTITIAL,
        INTERSTITIAL,
        BANNER
    }

    private FrameLayout rootLayout;
    private WebView webView;
    private FrameLayout bannerOverlayContainer;
    private AdView bannerAdView;

    private RewardedAd rewardedAd;
    private RewardedInterstitialAd rewardedInterstitialAd;
    private InterstitialAd interstitialAd;

    private DetectedFormat detectedFormat = DetectedFormat.UNKNOWN;
    private boolean sdkInitialized = false;
    private boolean isLoadingAd = false;
    private boolean isShowingAd = false;
    private boolean isActivityPaused = false;
    private String lastLoadError = "";

    private String queuedShowPurpose = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable queuedTimeoutRunnable = this::onQueuedShowTimedOut;

    private String pendingJsPurpose = null;
    private boolean pendingJsGranted = false;
    private String pendingJsMessage = null;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(0xFF080A0F);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF080A0F);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        rootLayout.addView(
                webView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        bannerOverlayContainer = new FrameLayout(this);
        bannerOverlayContainer.setVisibility(View.GONE);
        bannerOverlayContainer.setBackgroundColor(0xCC05070D);
        rootLayout.addView(
                bannerOverlayContainer,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );

        setContentView(rootLayout);

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();
        webView.setOnTouchListener((v, event) -> {
            if (!v.hasFocus()) {
                v.requestFocus();
            }
            return false;
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", path -> {
                    try {
                        String cleanPath = path;
                        while (cleanPath.startsWith("/")) {
                            cleanPath = cleanPath.substring(1);
                        }
                        if (cleanPath.isEmpty()) {
                            cleanPath = "index.html";
                        }
                        String assetPath = cleanPath.startsWith("public/") ? cleanPath : "public/" + cleanPath;
                        InputStream is = getAssets().open(assetPath);
                        String mimeType = getMimeType(assetPath);
                        Map<String, String> responseHeaders = new HashMap<>();
                        responseHeaders.put("Access-Control-Allow-Origin", "*");
                        responseHeaders.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                        responseHeaders.put("Access-Control-Allow-Headers", "*");
                        return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", responseHeaders, is);
                    } catch (IOException e) {
                        Log.w(TAG, "Asset not found for path '" + path + "': " + e.getMessage());
                        return null;
                    }
                })
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request
            ) {
                Uri url = request.getUrl();
                if ("appassets.androidplatform.net".equals(url.getHost())) {
                    return assetLoader.shouldInterceptRequest(url);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    if (request.isForMainFrame()) {
                        Uri url = request.getUrl();
                        if (url != null && !"appassets.androidplatform.net".equals(url.getHost())) {
                            try {
                                startActivity(new Intent(Intent.ACTION_VIEW, url));
                            } catch (Exception ignored) {
                            }
                            return true;
                        }
                    }
                } else {
                    Uri url = request.getUrl();
                    if (url != null && !"appassets.androidplatform.net".equals(url.getHost())) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, url));
                        } catch (Exception ignored) {
                        }
                        return true;
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("WebConsole", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }
        });

        webView.addJavascriptInterface(new AndroidAdsBridge(), "AndroidAdsBridge");
        webView.loadUrl("https://appassets.androidplatform.net/index.html");
        enableImmersiveMode();

        MobileAds.initialize(this, initializationStatus -> runOnUiThread(() -> {
            sdkInitialized = true;
            loadAdIfNeeded();
        }));
    }

    private boolean hasLoadedFullScreenAd() {
        return rewardedAd != null || rewardedInterstitialAd != null || interstitialAd != null;
    }

    private boolean hasReadyAd() {
        return hasLoadedFullScreenAd() || (detectedFormat == DetectedFormat.BANNER && bannerAdView != null);
    }

    private void loadAdIfNeeded() {
        if (!sdkInitialized || isLoadingAd || hasLoadedFullScreenAd() || isFinishing() || isDestroyed()) {
            return;
        }
        isLoadingAd = true;
        AdRequest adRequest = new AdRequest.Builder().build();

        if (detectedFormat == DetectedFormat.INTERSTITIAL) {
            loadInterstitial(adRequest, false);
        } else if (detectedFormat == DetectedFormat.REWARDED_INTERSTITIAL) {
            loadRewardedInterstitial(adRequest, false);
        } else if (detectedFormat == DetectedFormat.BANNER) {
            loadBannerFallback(adRequest);
        } else {
            loadRewarded(adRequest);
        }
    }

    private void loadRewarded(AdRequest adRequest) {
        RewardedAd.load(
                this,
                ADMOB_AD_UNIT_ID,
                adRequest,
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        rewardedAd = ad;
                        detectedFormat = DetectedFormat.REWARDED;
                        isLoadingAd = false;
                        lastLoadError = "";
                        flushQueuedAdIfReady();
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        rewardedAd = null;
                        lastLoadError = loadAdError.getMessage();
                        Log.w(TAG, "RewardedAd failed (" + loadAdError.getCode() + "): " + lastLoadError);
                        loadRewardedInterstitial(adRequest, true);
                    }
                }
        );
    }

    private void loadRewardedInterstitial(AdRequest adRequest, boolean allowFallback) {
        RewardedInterstitialAd.load(
                this,
                ADMOB_AD_UNIT_ID,
                adRequest,
                new RewardedInterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedInterstitialAd ad) {
                        rewardedInterstitialAd = ad;
                        detectedFormat = DetectedFormat.REWARDED_INTERSTITIAL;
                        isLoadingAd = false;
                        lastLoadError = "";
                        flushQueuedAdIfReady();
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        rewardedInterstitialAd = null;
                        lastLoadError = loadAdError.getMessage();
                        Log.w(TAG, "RewardedInterstitialAd failed (" + loadAdError.getCode() + "): " + lastLoadError);
                        if (allowFallback) {
                            loadInterstitial(adRequest, true);
                        } else {
                            finishLoadFailure();
                        }
                    }
                }
        );
    }

    private void loadInterstitial(AdRequest adRequest, boolean allowFallback) {
        InterstitialAd.load(
                this,
                ADMOB_AD_UNIT_ID,
                adRequest,
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(@NonNull InterstitialAd ad) {
                        interstitialAd = ad;
                        detectedFormat = DetectedFormat.INTERSTITIAL;
                        isLoadingAd = false;
                        lastLoadError = "";
                        flushQueuedAdIfReady();
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        interstitialAd = null;
                        lastLoadError = loadAdError.getMessage();
                        Log.w(TAG, "InterstitialAd failed (" + loadAdError.getCode() + "): " + lastLoadError);
                        if (allowFallback) {
                            loadBannerFallback(adRequest);
                        } else {
                            finishLoadFailure();
                        }
                    }
                }
        );
    }

    private void loadBannerFallback(AdRequest adRequest) {
        if (bannerAdView != null) {
            bannerAdView.destroy();
            bannerAdView = null;
        }
        bannerOverlayContainer.removeAllViews();

        final AdView adView = new AdView(this);
        adView.setAdUnitId(ADMOB_AD_UNIT_ID);
        adView.setAdSize(AdSize.MEDIUM_RECTANGLE);
        adView.setAdListener(new AdListener() {
            @Override
            public void onAdLoaded() {
                bannerAdView = adView;
                detectedFormat = DetectedFormat.BANNER;
                isLoadingAd = false;
                lastLoadError = "";
                flushQueuedAdIfReady();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                adView.destroy();
                bannerAdView = null;
                lastLoadError = loadAdError.getMessage();
                Log.w(TAG, "BannerAd failed (" + loadAdError.getCode() + "): " + lastLoadError);
                finishLoadFailure();
            }
        });

        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.setGravity(Gravity.CENTER);
        wrapper.setPadding(24, 24, 24, 24);
        wrapper.addView(adView);

        bannerOverlayContainer.addView(
                wrapper,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER
                )
        );
        adView.loadAd(adRequest);
    }

    private void finishLoadFailure() {
        isLoadingAd = false;
        if (queuedShowPurpose != null) {
            String p = queuedShowPurpose;
            queuedShowPurpose = null;
            mainHandler.removeCallbacks(queuedTimeoutRunnable);
            String reason = lastLoadError.isEmpty()
                    ? "Ad failed to load. Check internet connection."
                    : "Ad unavailable: " + lastLoadError;
            notifyWebAdResult(p, false, reason);
        }
    }

    private void flushQueuedAdIfReady() {
        if (queuedShowPurpose != null && hasReadyAd()) {
            String p = queuedShowPurpose;
            queuedShowPurpose = null;
            mainHandler.removeCallbacks(queuedTimeoutRunnable);
            presentLoadedAd(p);
        }
    }

    private void onQueuedShowTimedOut() {
        if (queuedShowPurpose != null) {
            String p = queuedShowPurpose;
            queuedShowPurpose = null;
            String reason = lastLoadError.isEmpty()
                    ? "Ad request timed out. Please check connection and retry."
                    : "Ad unavailable: " + lastLoadError;
            notifyWebAdResult(p, false, reason);
        }
    }

    private void notifyWebAdResult(String purpose, boolean granted, String message) {
        mainHandler.post(() -> {
            isShowingAd = false;
            if (isActivityPaused) {
                pendingJsPurpose = purpose;
                pendingJsGranted = granted;
                pendingJsMessage = message;
                return;
            }
            deliverJsResult(purpose, granted, message);
        });
    }

    private void deliverJsResult(String purpose, boolean granted, String message) {
        if (webView == null) return;
        webView.onResume();
        String js = "window.__onAndroidAdComplete && window.__onAndroidAdComplete("
                + JSONObject.quote(purpose)
                + ","
                + (granted ? "true" : "false")
                + ","
                + JSONObject.quote(message)
                + ");";
        webView.evaluateJavascript(js, null);
    }

    private class AndroidAdsBridge {
        @JavascriptInterface
        public boolean isAdReady() {
            return hasReadyAd();
        }

        @JavascriptInterface
        public String getLastError() {
            return lastLoadError;
        }

        @JavascriptInterface
        public void preloadAd() {
            runOnUiThread(MainActivity.this::loadAdIfNeeded);
        }

        @JavascriptInterface
        public void showAd(final String purpose) {
            runOnUiThread(() -> requestShowAd(purpose == null ? "double_coins" : purpose));
        }
    }

    private void requestShowAd(final String purpose) {
        if (isShowingAd) {
            notifyWebAdResult(purpose, false, "An ad is already open.");
            return;
        }
        if (hasReadyAd()) {
            presentLoadedAd(purpose);
            return;
        }
        queuedShowPurpose = purpose;
        mainHandler.removeCallbacks(queuedTimeoutRunnable);
        mainHandler.postDelayed(queuedTimeoutRunnable, 12000);
        if (!isLoadingAd) {
            loadAdIfNeeded();
        }
    }

    private void presentLoadedAd(final String purpose) {
        if (rewardedAd != null) {
            final RewardedAd ad = rewardedAd;
            rewardedAd = null;
            isShowingAd = true;
            final boolean[] rewardEarned = {false};

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    enableImmersiveMode();
                    loadAdIfNeeded();
                    notifyWebAdResult(
                            purpose,
                            rewardEarned[0],
                            rewardEarned[0] ? "Ad reward claimed!" : "Watch full ad to claim reward."
                    );
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    enableImmersiveMode();
                    loadAdIfNeeded();
                    notifyWebAdResult(purpose, false, "Ad failed to display: " + adError.getMessage());
                }
            });
            ad.show(this, rewardItem -> rewardEarned[0] = true);
            return;
        }

        if (rewardedInterstitialAd != null) {
            final RewardedInterstitialAd ad = rewardedInterstitialAd;
            rewardedInterstitialAd = null;
            isShowingAd = true;
            final boolean[] rewardEarned = {false};

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    enableImmersiveMode();
                    loadAdIfNeeded();
                    notifyWebAdResult(
                            purpose,
                            rewardEarned[0],
                            rewardEarned[0] ? "Ad reward claimed!" : "Watch full ad to claim reward."
                    );
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    enableImmersiveMode();
                    loadAdIfNeeded();
                    notifyWebAdResult(purpose, false, "Ad failed to display: " + adError.getMessage());
                }
            });
            ad.show(this, rewardItem -> rewardEarned[0] = true);
            return;
        }

        if (interstitialAd != null) {
            final InterstitialAd ad = interstitialAd;
            interstitialAd = null;
            isShowingAd = true;

            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    enableImmersiveMode();
                    loadAdIfNeeded();
                    notifyWebAdResult(purpose, true, "Ad completed! Reward granted.");
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    enableImmersiveMode();
                    loadAdIfNeeded();
                    notifyWebAdResult(purpose, false, "Ad failed to display: " + adError.getMessage());
                }
            });
            ad.show(this);
            return;
        }

        if (detectedFormat == DetectedFormat.BANNER && bannerAdView != null) {
            isShowingAd = true;
            presentBannerOverlay(purpose);
            return;
        }

        loadAdIfNeeded();
        notifyWebAdResult(purpose, false, "Ad is loading. Try again in a moment.");
    }

    private void presentBannerOverlay(final String purpose) {
        if (bannerOverlayContainer.getChildCount() == 0) {
            bannerOverlayContainer.setVisibility(View.GONE);
            isShowingAd = false;
            notifyWebAdResult(purpose, false, "Ad container empty.");
            return;
        }

        View child = bannerOverlayContainer.getChildAt(0);
        if (child instanceof LinearLayout) {
            LinearLayout wrapper = (LinearLayout) child;
            while (wrapper.getChildCount() > 1) {
                wrapper.removeViewAt(1);
            }
            Button closeBtn = new Button(this);
            closeBtn.setText("CLAIM REWARD & CLOSE (3s)");
            closeBtn.setEnabled(false);
            closeBtn.setTextColor(Color.WHITE);
            closeBtn.setBackgroundColor(0xFF0F172A);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            lp.topMargin = 18;
            wrapper.addView(closeBtn, lp);

            bannerOverlayContainer.setVisibility(View.VISIBLE);
            mainHandler.postDelayed(() -> {
                closeBtn.setEnabled(true);
                closeBtn.setText("CLOSE AD & CLAIM REWARD");
                closeBtn.setBackgroundColor(0xFFF59E0B);
                closeBtn.setTextColor(0xFF090D16);
            }, 3000);

            closeBtn.setOnClickListener(v -> {
                bannerOverlayContainer.setVisibility(View.GONE);
                if (bannerAdView != null) {
                    bannerAdView.loadAd(new AdRequest.Builder().build());
                }
                enableImmersiveMode();
                notifyWebAdResult(purpose, true, "Ad completed! Reward granted.");
            });
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveMode();
        }
    }

    @Override
    protected void onPause() {
        isActivityPaused = true;
        if (webView != null && !isShowingAd) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        isActivityPaused = false;
        if (webView != null) {
            webView.onResume();
        }
        enableImmersiveMode();
        if (pendingJsPurpose != null) {
            String p = pendingJsPurpose;
            boolean g = pendingJsGranted;
            String m = pendingJsMessage;
            pendingJsPurpose = null;
            pendingJsMessage = null;
            deliverJsResult(p, g, m);
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        if (bannerAdView != null) {
            bannerAdView.destroy();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private void enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }

    private static String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }
}
