// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CampaignMapBackground } from './CampaignMapBackground';

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
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reproduz o mapa em loop e sem áudio, revelando o vídeo somente após iniciar a reprodução', () => {
  const { container } = render(<CampaignMapBackground />);
  const video = container.querySelector('video')!;
  expect(video.src).toContain('mapa-campanha-animado-v2.webm');
  expect(video.autoplay).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video.controls).toBe(false);
  expect(video).toHaveAttribute('aria-hidden', 'true');
  expect(video).toHaveAttribute('tabindex', '-1');
  expect(video).not.toHaveClass('is-playing');
  expect((screen.getByRole('img', { name: 'Mapa de Berdal e das rotas da primeira jornada' }) as HTMLImageElement).src).toBe(video.poster);
  fireEvent.playing(video);
  expect(video).toHaveClass('is-playing');
});

it('mantém o mapa estático se o vídeo falhar ao carregar', () => {
  const { container } = render(<CampaignMapBackground />);
  fireEvent.error(container.querySelector('video')!);
  expect(container.querySelector('video')).toBeNull();
  expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('mapa-campanha-01.png'));
});

it('preserva o fallback se o navegador bloquear a reprodução automática', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('Autoplay blocked'));
  const { container } = render(<CampaignMapBackground />);
  await act(async () => {});
  expect(container.querySelector('video')).not.toHaveClass('is-playing');
  expect(screen.getByRole('img')).toBeInTheDocument();
});

it('não carrega o vídeo com movimento reduzido e acompanha mudanças dessa preferência', () => {
  reduced = true;
  const { container, unmount } = render(<CampaignMapBackground />);
  expect(container.querySelector('video')).toBeNull();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(screen.getByRole('img')).toBeInTheDocument();
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).not.toBeNull();
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).toBeNull();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.size).toBe(0);
});

it('pausa em aba oculta, retoma do mesmo instante e interrompe a reprodução ao sair do mapa', () => {
  const { container, unmount } = render(<CampaignMapBackground />);
  const video = container.querySelector('video')!;
  video.currentTime = 3;
  hidden = true;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  hidden = false;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  expect(video.currentTime).toBe(3);
  unmount();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});
