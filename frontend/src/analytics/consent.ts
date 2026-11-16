import { useEffect, useState } from 'react';

export const ANALYTICS_CONSENT_KEY = 'rave-trail-analytics-consent-v1';
const CHANGE_EVENT = 'rave-trail-analytics-consent-change';
export type AnalyticsConsent = 'accepted' | 'declined' | null;

function parseConsent(value: unknown): AnalyticsConsent {
  return value === 'accepted' || value === 'declined' ? value : null;
}

function readConsent(): AnalyticsConsent {
  try { return parseConsent(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)); }
  catch { return null; }
}

export function useAnalyticsConsent() {
  // Match build-time HTML before reading browser storage during hydration.
  const [consent, setConsent] = useState<AnalyticsConsent>(null);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ consent: AnalyticsConsent; persisted: boolean }>).detail;
      setConsent(detail.consent);
      setPersisted(detail.persisted);
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
      catch { return; }
      setConsent(readConsent());
      setPersisted(true);
    };
    window.addEventListener(CHANGE_EVENT, changed);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener(CHANGE_EVENT, changed);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);

  function choose(next: Exclude<AnalyticsConsent, null>) {
    let saved = true;
    try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, next); }
    catch { saved = false; }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { consent: next, persisted: saved } }));
  }

  return { consent, ready, persisted, choose };
}
