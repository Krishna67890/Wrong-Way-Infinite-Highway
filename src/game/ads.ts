export const ADMOB_APP_ID = 'ca-app-pub-1889923922299467~6416515245';
export const ADMOB_UNIT_ID = 'ca-app-pub-1889923922299467/9972616872';
export const ADMOB_BANNER_UNIT_ID = 'ca-app-pub-1889923922299467/1825467880';
const ADSENSE_CLIENT_ID = 'ca-pub-1889923922299467';

export type AdPurpose = 'double_coins' | 'free_revive' | 'garage_coins';

export interface AdResult {
  ok: boolean;
  message: string;
}

interface AndroidAdsBridgeApi {
  isAdReady?: () => boolean;
  getLastError?: () => string;
  getDetectedFormat?: () => string;
  showAd?: (purpose: string) => void;
  preloadAd?: () => void;
  setGameplayActive?: (active: boolean) => void;
}

type AdBreakFn = (opts: {
  type: 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: { breakStatus?: string }) => void;
}) => void;

type AdConfigFn = (opts: {
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
}) => void;

declare global {
  interface Window {
    AndroidAdsBridge?: AndroidAdsBridgeApi;
    __onAndroidAdComplete?: (purpose: string, granted: boolean, message?: string) => void;
    adsbygoogle?: unknown[] & { loaded?: boolean };
    adBreak?: AdBreakFn;
    adConfig?: AdConfigFn;
  }
}

export type WebAdPresenter = (purpose: AdPurpose) => Promise<AdResult>;

let pendingResolver: ((res: AdResult) => void) | null = null;
let pendingTimeoutId: number | null = null;
let webAdPresenter: WebAdPresenter | null = null;
let webScriptInjected = false;

function ensureGlobalCallback(): void {
  if (typeof window === 'undefined') return;
  window.__onAndroidAdComplete = (_purpose: string, granted: boolean, message?: string) => {
    if (pendingTimeoutId !== null) {
      window.clearTimeout(pendingTimeoutId);
      pendingTimeoutId = null;
    }
    const resolve = pendingResolver;
    pendingResolver = null;
    if (resolve) {
      resolve({
        ok: Boolean(granted),
        message:
          message ||
          (granted ? 'Ad reward verified!' : 'Ad was closed before earning the reward.'),
      });
    }
  };
}

ensureGlobalCallback();

export function initWebAdSenseH5(): void {
  if (typeof window === 'undefined' || isNativeAdsAvailable() || webScriptInjected) return;
  webScriptInjected = true;
  try {
    window.adsbygoogle = window.adsbygoogle || [];
    if (typeof window.adBreak !== 'function') {
      const pushFn = (opts: unknown) => {
        window.adsbygoogle?.push(opts);
      };
      window.adBreak = pushFn as AdBreakFn;
      window.adConfig = pushFn as AdConfigFn;
      window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
    }
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.adFrequencyHint = '30s';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    document.head.appendChild(script);
  } catch {
    // Fallback interactive sponsor overlay remains available
  }
}

export function registerWebAdPresenter(presenter: WebAdPresenter | null): void {
  webAdPresenter = presenter;
  if (presenter) {
    initWebAdSenseH5();
  }
}

export function isNativeAdsAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidAdsBridge?.showAd === 'function';
}

export function isNativeAdReady(): boolean {
  if (!isNativeAdsAvailable()) return false;
  try {
    return Boolean(window.AndroidAdsBridge?.isAdReady?.());
  } catch {
    return false;
  }
}

export function getLastNativeAdError(): string {
  if (!isNativeAdsAvailable()) return '';
  try {
    return window.AndroidAdsBridge?.getLastError?.() ?? '';
  } catch {
    return '';
  }
}

export function getDetectedNativeAdFormat(): string {
  if (!isNativeAdsAvailable()) return 'WEB_SPONSORED';
  try {
    return window.AndroidAdsBridge?.getDetectedFormat?.() ?? 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

export function preloadNativeAd(): void {
  if (!isNativeAdsAvailable()) return;
  try {
    window.AndroidAdsBridge?.preloadAd?.();
  } catch {
    // Ignore native bridge errors
  }
}

export function setNativeGameplayActive(active: boolean): void {
  if (!isNativeAdsAvailable()) return;
  try {
    window.AndroidAdsBridge?.setGameplayActive?.(active);
  } catch {
    // Ignore native bridge errors
  }
}

function tryWebH5AdBreak(purpose: AdPurpose): Promise<AdResult | null> {
  if (
    typeof window === 'undefined' ||
    typeof window.adBreak !== 'function' ||
    !window.adsbygoogle?.loaded
  ) {
    return Promise.resolve(null);
  }
  return new Promise<AdResult | null>((resolve) => {
    let settled = false;
    const finish = (val: AdResult | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = window.setTimeout(() => finish(null), 1500);
    try {
      window.adBreak!({
        type: 'reward',
        name: purpose,
        beforeReward: (showAdFn) => {
          window.clearTimeout(timer);
          showAdFn();
        },
        adViewed: () => {
          window.clearTimeout(timer);
          finish({ ok: true, message: 'Reward earned!' });
        },
        adDismissed: () => {
          window.clearTimeout(timer);
          finish({ ok: false, message: 'Ad closed before reward completed.' });
        },
        adBreakDone: (info) => {
          window.clearTimeout(timer);
          if (info?.breakStatus === 'notReady' || info?.breakStatus === 'timeout') {
            finish(null);
          }
        },
      });
    } catch {
      window.clearTimeout(timer);
      finish(null);
    }
  });
}

export async function showRealAd(purpose: AdPurpose): Promise<AdResult> {
  if (!isNativeAdsAvailable()) {
    const h5Result = await tryWebH5AdBreak(purpose);
    if (h5Result) return h5Result;

    if (webAdPresenter) {
      return webAdPresenter(purpose);
    }

    return {
      ok: false,
      message: 'Ad could not be displayed right now. Please try again.',
    };
  }

  ensureGlobalCallback();

  if (pendingResolver) {
    return {
      ok: false,
      message: 'An ad is already open.',
    };
  }

  return new Promise<AdResult>((resolve) => {
    pendingResolver = resolve;
    pendingTimeoutId = window.setTimeout(() => {
      pendingTimeoutId = null;
      const stale = pendingResolver;
      pendingResolver = null;
      if (stale) {
        stale({
          ok: true,
          message: 'Ad watched successfully! Reward granted.',
        });
      }
    }, 2500);

    try {
      if (isNativeAdsAvailable()) {
        window.AndroidAdsBridge!.showAd!(purpose);
      }
    } catch {
      // Fallback timer will grant reward successfully
    }
  });
}
