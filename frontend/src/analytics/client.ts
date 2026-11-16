export type AnalyticsScreen = 'title' | 'auth' | 'menu' | 'characters' | 'store' | 'campaigns'
  | 'map' | 'quick-battle' | 'unlocks' | 'battle' | 'unsupported-viewport' | 'about';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

// No browser access or network activity at import time (also imported by SSR).
let active = false;
let loaded = false;
let measurementId = '';
let script: HTMLScriptElement | null = null;
let currentScreen: AnalyticsScreen | null = null;
let sentScreen: AnalyticsScreen | null = null;
let previousLocation = '';

function command(...args: unknown[]) {
  (window as AnalyticsWindow).gtag?.(...args);
}

function disable(disabled: boolean) {
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
}

function clearCookies() {
  const domains = window.location.hostname.split('.');
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name !== '_ga' && !name?.startsWith('_ga_')) continue;
    const expired = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = expired;
    for (let index = 0; index < domains.length - 1; index++) {
      document.cookie = `${expired}; domain=${domains.slice(index).join('.')}`;
      document.cookie = `${expired}; domain=.${domains.slice(index).join('.')}`;
    }
  }
}

function pageParameters(screen: AnalyticsScreen) {
  // Never forward arbitrary URLs, query strings, fragments or form content.
  const path = screen === 'about' ? '/sobre/' : screen === 'unsupported-viewport'
    ? '/acesse-pelo-computador' : `/game/${screen}`;
  let referrer = '';
  try { referrer = new URL(document.referrer).origin; } catch { /* No external referrer. */ }
  return {
    screen_name: screen,
    page_title: `Rave Trail — ${screen}`,
    page_location: new URL(path, window.location.origin).href,
    page_referrer: previousLocation || referrer,
  };
}

function sendScreen() {
  if (!active || !loaded || !currentScreen || currentScreen === sentScreen) return;
  const parameters = pageParameters(currentScreen);
  command('set', parameters);
  command('event', 'page_view', parameters);
  previousLocation = parameters.page_location;
  sentScreen = currentScreen;
}

function configure() {
  if (!active) return;
  command('consent', 'default', {
    analytics_storage: 'granted', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  });
  command('js', new Date());
  command('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_path: '/',
    ...(currentScreen ? pageParameters(currentScreen) : {}),
  });
  sendScreen();
}

export function setAnalyticsScreen(screen: AnalyticsScreen) {
  currentScreen = screen;
  sendScreen();
}

export function setAnalyticsCollection(approved: boolean, config: { enabled: boolean; measurementId: string }) {
  if (!approved || !config.enabled) {
    active = false;
    if (measurementId) disable(true);
    sentScreen = null;
    previousLocation = '';
    // Discard queued commands if approval is withdrawn while the tag is loading.
    const layer = (window as AnalyticsWindow).dataLayer;
    if (layer) layer.length = 0;
    clearCookies();
    return;
  }
  if (active) return;
  measurementId = config.measurementId;
  active = true;
  disable(false);
  if (loaded) { configure(); return; }
  if (script) return;
  const browser = window as AnalyticsWindow;
  browser.dataLayer ??= [];
  browser.gtag ??= function (..._args: unknown[]) { browser.dataLayer!.push(arguments); };
  script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.onload = () => { loaded = true; configure(); };
  script.onerror = () => {
    script?.remove();
    script = null;
    active = false;
    disable(true);
  };
  document.head.append(script);
}
