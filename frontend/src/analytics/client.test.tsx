// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

const config = { enabled: true, measurementId: 'G-B68K6N7WP1' };
let client: typeof import('./client');
const browser = window as unknown as Record<string, unknown>;

beforeEach(async () => {
  vi.resetModules();
  document.head.querySelectorAll('script').forEach((script) => script.remove());
  delete browser.gtag;
  delete browser.dataLayer;
  delete browser['ga-disable-G-B68K6N7WP1'];
  document.cookie = '_ga=; Max-Age=0; path=/';
  document.cookie = '_ga_B68K6N7WP1=; Max-Age=0; path=/';
  client = await import('./client');
});

function queuedCommands() {
  return ((browser.dataLayer ?? []) as IArguments[]).map((args) => Array.from(args));
}

it('não carrega o Google nem prepara envios antes da aprovação ou com configuração desativada', () => {
  client.setAnalyticsScreen('auth');
  client.setAnalyticsCollection(false, config);
  client.setAnalyticsCollection(true, { ...config, enabled: false });
  expect(document.querySelector('script')).toBeNull();
  expect(browser.gtag).toBeUndefined();
  expect(queuedCommands()).toEqual([]);
});

it('carrega após aprovação e registra apenas a tela atual, deduplicando renderizações', () => {
  client.setAnalyticsScreen('title');
  client.setAnalyticsScreen('auth');
  client.setAnalyticsCollection(true, config);
  const script = document.querySelector('script')!;
  expect(script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-B68K6N7WP1');
  client.setAnalyticsCollection(true, config);
  expect(document.querySelectorAll('script')).toHaveLength(1);
  expect(queuedCommands()).toEqual([]);
  script.dispatchEvent(new Event('load'));
  client.setAnalyticsScreen('auth');
  client.setAnalyticsScreen('menu');
  const views = queuedCommands().filter((args) => args[0] === 'event');
  expect(views).toHaveLength(2);
  expect(views[0]).toEqual(['event', 'page_view', expect.objectContaining({ screen_name: 'auth' })]);
  expect(views[1]).toEqual(['event', 'page_view', expect.objectContaining({ screen_name: 'menu' })]);
  expect(queuedCommands()).toContainEqual(['config', config.measurementId, expect.objectContaining({
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
  })]);
});

it('ignora o carregamento tardio após revogação e permite aprovar novamente', () => {
  client.setAnalyticsScreen('title');
  client.setAnalyticsCollection(true, config);
  const script = document.querySelector('script')!;
  client.setAnalyticsCollection(false, config);
  script.dispatchEvent(new Event('load'));
  expect(queuedCommands()).toEqual([]);
  expect(browser['ga-disable-G-B68K6N7WP1']).toBe(true);
  client.setAnalyticsScreen('menu');
  client.setAnalyticsCollection(true, config);
  expect(browser['ga-disable-G-B68K6N7WP1']).toBe(false);
  expect(queuedCommands().filter((args) => args[0] === 'event')).toEqual([
    ['event', 'page_view', expect.objectContaining({ screen_name: 'menu' })],
  ]);
});

it('interrompe envios e remove cookies do GA sem apagar outros cookies', () => {
  document.cookie = '_ga=identifier; path=/';
  document.cookie = '_ga_B68K6N7WP1=session; path=/';
  document.cookie = 'other=keep; path=/';
  client.setAnalyticsScreen('about');
  client.setAnalyticsCollection(true, config);
  document.querySelector('script')!.dispatchEvent(new Event('load'));
  client.setAnalyticsCollection(false, config);
  client.setAnalyticsScreen('battle');
  expect(queuedCommands()).toEqual([]);
  expect(browser['ga-disable-G-B68K6N7WP1']).toBe(true);
  expect(document.cookie).not.toMatch(/_ga/);
  expect(document.cookie).toContain('other=keep');
});

it('não encaminha parâmetros arbitrários nem fragmentos da URL', () => {
  window.history.replaceState(null, '', '/?email=private%40example.com#secret');
  try {
    client.setAnalyticsScreen('about');
    client.setAnalyticsCollection(true, config);
    document.querySelector('script')!.dispatchEvent(new Event('load'));
    expect(JSON.stringify(queuedCommands())).not.toMatch(/private|secret|email=/);
    expect(queuedCommands()).toContainEqual(['event', 'page_view', expect.objectContaining({
      page_location: `${window.location.origin}/sobre/`,
    })]);
  } finally { window.history.replaceState(null, '', '/'); }
});

it('tolera erro do script e permite uma nova tentativa após aprovação', () => {
  client.setAnalyticsCollection(true, config);
  document.querySelector('script')!.dispatchEvent(new Event('error'));
  expect(document.querySelector('script')).toBeNull();
  expect(queuedCommands()).toEqual([]);
  client.setAnalyticsCollection(true, config);
  expect(document.querySelector('script')).not.toBeNull();
});
