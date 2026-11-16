const measurementId = (import.meta.env?.VITE_GA_MEASUREMENT_ID ?? '').trim();

// Habilitar a configuração não substitui o consentimento do visitante.
// Este módulo apenas lê configuração: não carrega scripts nem envia eventos.
export const analyticsConfig = {
  enabled: import.meta.env?.PROD
    && import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
    && /^G-[A-Z0-9]+$/.test(measurementId),
  measurementId,
} as const;
