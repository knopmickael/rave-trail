// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SkyBackground } from './SkyBackground';

let reduced = false;
let hidden = false;
let listeners: Set<() => void>;
let finishDownload: (blob: Blob) => void;

async function download() {
  await act(async () => { finishDownload(new Blob(['video'], { type: 'video/mp4' })); });
}

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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => new Promise<Blob>((resolve) => { finishDownload = resolve; }) }));
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:menu-video'), revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('mostra o frame estático e aguarda o corpo inteiro do MP4 antes de reproduzir', async () => {
  const { container } = render(<SkyBackground />);
  await act(async () => {});
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('.sky-background-media')).toHaveStyle({ backgroundImage: 'url("/media/video/menu-background-poster.webp")' });
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith('/media/video/menu-background-default.mp4', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  await download();
  const video = container.querySelector('video')!;
  expect(video.getAttribute('src')).toBe('blob:menu-video');
  expect(video.playbackRate).toBe(0.5);
  expect(video.defaultPlaybackRate).toBe(0.5);
  expect(video.loop).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video.controls).toBe(false);
  expect(video.closest('.sky-background')).toHaveAttribute('aria-hidden', 'true');
  expect(video).not.toHaveClass('is-playing');
  fireEvent.playing(video);
  expect(video).toHaveClass('is-playing');
});

it('não monta ou carrega vídeo quando o sistema pede redução de movimento', () => {
  reduced = true;
  const { container } = render(<SkyBackground />);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('.sky-background-media')).toHaveStyle({ backgroundImage: 'url("/media/video/menu-background-poster.webp")' });
  expect(fetch).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

it('acompanha mudanças na preferência de movimento sem recarregar a página', async () => {
  const { container, unmount } = render(<SkyBackground />);
  await act(async () => {});
  await download();
  expect(container.querySelector('video')).not.toBeNull();
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).toBeNull();
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  await act(async () => {});
  await download();
  expect(container.querySelector('video')).not.toBeNull();
  unmount();
  expect(listeners.size).toBe(0);
});

it('pausa em aba oculta e retoma ao voltar na mesma velocidade', async () => {
  render(<SkyBackground />);
  await act(async () => {});
  await download();
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  hidden = true;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  hidden = false;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});

it('mantém a imagem estática se o vídeo não puder ser decodificado', async () => {
  const { container } = render(<SkyBackground />);
  await act(async () => {});
  await download();
  fireEvent.error(container.querySelector('video')!);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('.sky-background-media')).toHaveStyle({ backgroundImage: 'url("/media/video/menu-background-poster.webp")' });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:menu-video');
});

it('altera somente o tema após a vitória, sem baixar ou reiniciar o vídeo', async () => {
  const view = render(<SkyBackground />);
  await act(async () => {});
  await download();
  const video = view.container.querySelector('video')!;
  video.currentTime = 12;
  view.rerender(<SkyBackground sunset />);
  expect(view.container.querySelector('.sky-background')).toHaveClass('sky-background--sunset');
  expect(view.container.querySelector('video')).toBe(video);
  expect(video.currentTime).toBe(12);
  expect(video.playbackRate).toBe(0.5);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
});

it('mantém o poster se o download falhar ou o autoplay for bloqueado', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  const view = render(<SkyBackground sunset />);
  await act(async () => {});
  expect(view.container.querySelector('video')).toBeNull();
  expect(view.container.querySelector('.sky-background')).toHaveClass('sky-background--sunset');
  view.unmount();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('autoplay'));
  const next = render(<SkyBackground />);
  await act(async () => {});
  await download();
  expect(next.container.querySelector('video')).not.toHaveClass('is-playing');
});

it('aborta o download pendente ao desmontar e ignora sua resposta atrasada', async () => {
  const view = render(<SkyBackground />);
  await act(async () => {});
  const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await download();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

it('libera o Blob ao reduzir movimento e não inicia o vídeo numa aba oculta', async () => {
  hidden = true;
  const view = render(<SkyBackground />);
  await act(async () => {});
  await download();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(view.container.querySelector('video')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:menu-video');
});
