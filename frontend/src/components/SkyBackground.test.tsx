// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SkyBackground } from './SkyBackground';

let reduced = false;
let hidden = false;
let listeners: Set<() => void>;

beforeEach(() => {
  reduced = false;
  hidden = false;
  listeners = new Set();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return reduced; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  })));
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('reproduz WebM decorativo sem áudio, em loop e sem controles', () => {
  const { container } = render(<SkyBackground />);
  const video = container.querySelector('video')!;
  expect(video.getAttribute('src')).toContain('sky-background.webm');
  expect(video.autoplay).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video.controls).toBe(false);
  expect(video.parentElement).toHaveAttribute('aria-hidden', 'true');
  fireEvent.playing(video);
  expect(video).toHaveClass('is-playing');
});

it('não monta ou carrega vídeo quando o sistema pede redução de movimento', () => {
  reduced = true;
  const { container } = render(<SkyBackground />);
  expect(container.querySelector('video')).toBeNull();
  expect((container.firstElementChild as HTMLElement).style.backgroundImage).toContain('sky-background.webp');
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

it('acompanha mudanças na preferência de movimento sem recarregar a página', () => {
  const { container, unmount } = render(<SkyBackground />);
  expect(container.querySelector('video')).not.toBeNull();
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).toBeNull();
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).not.toBeNull();
  unmount();
  expect(listeners.size).toBe(0);
});

it('pausa em aba oculta e retoma ao voltar', () => {
  render(<SkyBackground />);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  hidden = true;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  hidden = false;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});

it('mantém a imagem estática se o vídeo não carregar', () => {
  const { container } = render(<SkyBackground />);
  fireEvent.error(container.querySelector('video')!);
  expect(container.querySelector('video')).toBeNull();
  expect((container.firstElementChild as HTMLElement).style.backgroundImage).toContain('sky-background.webp');
});
