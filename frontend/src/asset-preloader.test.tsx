// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); });

it('começa pelos assets recebidos, limita a concorrência e não repete imagens já carregadas', async () => {
  vi.resetModules();
  const started: FakeImage[] = [];
  class FakeImage {
    naturalWidth = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_src: string) { started.push(this); }
  }
  vi.stubGlobal('Image', FakeImage);
  const { preloadDataAssets } = await import('./asset-preloader');
  const urls = Array.from({ length: 12 }, (_, index) => `/media/portraits/${index}.webp`);
  preloadDataAssets({ units: urls.map((portrait) => ({ portrait, illustration: portrait })) });
  expect(started).toHaveLength(6);
  started[0].onload!();
  expect(started).toHaveLength(7);
  for (let index = 1; index < 12; index++) started[index].onload!();
  preloadDataAssets(urls);
  expect(started).toHaveLength(12);
});

it('uma imagem indisponível não bloqueia a fila e pode ser tentada novamente', async () => {
  vi.resetModules();
  const started: FakeImage[] = [];
  class FakeImage {
    naturalWidth = 0;
    onerror: (() => void) | null = null;
    set src(_src: string) { started.push(this); }
  }
  vi.stubGlobal('Image', FakeImage);
  const { preloadDataAssets } = await import('./asset-preloader');
  preloadDataAssets('/media/missing.png');
  started[0].onerror!();
  preloadDataAssets('/media/missing.png');
  expect(started).toHaveLength(2);
});
