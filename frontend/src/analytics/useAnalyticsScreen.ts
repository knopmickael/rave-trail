import { useEffect } from 'react';
import { setAnalyticsScreen, type AnalyticsScreen } from './client';

export function useAnalyticsScreen(screen: AnalyticsScreen | null) {
  useEffect(() => {
    if (screen) setAnalyticsScreen(screen);
  }, [screen]);
}
