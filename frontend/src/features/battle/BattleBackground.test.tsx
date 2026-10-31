// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BattleBackground } from './BattleBackground';

let reduced: boolean;
let hidden: boolean;
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

it.each([false, true])('reproduz o cenário correto em loop silencioso e o revela somente ao iniciar (final: %s)', (finalBattle) => {
  const { container } = render(<BattleBackground finalBattle={finalBattle} />);
  const video = container.querySelector('video')!;
  expect(video.src).toContain(finalBattle ? 'battle-darkness.webm' : 'battle-clearing.webm');
  expect(video.poster).toContain(finalBattle ? 'evil-fight-background.png' : 'Clareira');
  expect(video.autoplay).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.controls).toBe(false);
  expect(video.playsInline).toBe(true);
  expect(video.parentElement).toHaveAttribute('aria-hidden', 'true');
  expect(video.parentElement).not.toHaveClass('is-playing');
  fireEvent.playing(video);
  expect(video.parentElement).toHaveClass('is-playing');
});

it('remove o vídeo se ocorrer um erro, deixando o fallback estático da batalha visível', () => {
  const { container } = render(<BattleBackground finalBattle={false} />);
  fireEvent.error(container.querySelector('video')!);
  expect(container.querySelector('.battle-background')).toBeNull();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
});

it('não encobre o fallback quando o navegador recusa a reprodução automática', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('Autoplay blocked'));
  const { container } = render(<BattleBackground finalBattle={false} />);
  await act(async () => {});
  expect(container.firstElementChild).not.toHaveClass('is-playing');
});

it('não carrega animações com movimento reduzido e acompanha alterações da preferência', () => {
  reduced = true;
  const { container, unmount } = render(<BattleBackground finalBattle />);
  expect(container.querySelector('video')).toBeNull();
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).not.toBeNull();
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(container.querySelector('video')).toBeNull();
  unmount();
  expect(listeners.size).toBe(0);
});

it('pausa em aba oculta, retoma sem reiniciar e limpa a reprodução ao sair da batalha', () => {
  const { container, rerender, unmount } = render(<BattleBackground finalBattle={false} />);
  const video = container.querySelector('video')!;
  video.currentTime = 4;
  rerender(<BattleBackground finalBattle={false} />);
  expect(video.currentTime).toBe(4);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  hidden = true;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  hidden = false;
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  expect(video.currentTime).toBe(4);
  unmount();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  fireEvent(document, new Event('visibilitychange'));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});
