// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameAudio } from './useGameAudio';
import { playSoundEffect } from './soundEffects';

let instances: FakeAudio[] = [];

class FakeAudio {
  src: string;
  loop = false;
  preload = '';
  volume = 1;
  currentTime = 0;
  paused = true;

  constructor(src: string) {
    this.src = src;
    instances.push(this);
  }

  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });

  pause() {
    this.paused = true;
  }
}

function AudioHarness({ inBattle, finalBattle = false, volume, muted }: { inBattle: boolean; finalBattle?: boolean; volume: number; muted: boolean }) {
  useGameAudio({ inBattle, finalBattle, volume, muted });
  return <main className={inBattle ? 'battle-page' : 'main-menu-screen'}>
    <button><span>Confirmar</span></button><button disabled>Bloqueado</button>
  </main>;
}

beforeEach(() => {
  instances = [];
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('reproduz a base em loop, troca para a batalha e respeita volume e silêncio', () => {
  const { rerender, unmount } = render(<AudioHarness inBattle={false} volume={40} muted={false} />);
  const [base, fight] = instances;

  expect(base.src).toContain('base.mp3');
  expect(fight.src).toContain('fight.ogg');
  expect(base.loop).toBe(true);
  expect(fight.loop).toBe(true);
  expect(base.volume).toBeCloseTo(0.4);
  expect(base.paused).toBe(false);
  expect(fight.paused).toBe(true);

  rerender(<AudioHarness inBattle volume={40} muted={false} />);
  expect(base.paused).toBe(true);
  expect(fight.paused).toBe(false);
  expect(fight.currentTime).toBe(0);

  rerender(<AudioHarness inBattle volume={75} muted={false} />);
  expect(fight.volume).toBeCloseTo(0.75);

  rerender(<AudioHarness inBattle volume={75} muted />);
  expect(fight.volume).toBe(0);

  unmount();
  expect(fight.paused).toBe(true);
});

it('seleciona a música final somente no duelo da campanha e retorna à faixa normal', () => {
  const { rerender } = render(<AudioHarness inBattle volume={50} muted={false} />);
  const [base, fight, finalFight] = instances;
  fight.currentTime = 12;
  rerender(<AudioHarness inBattle finalBattle volume={50} muted={false} />);
  expect(finalFight.src).toContain('final-fight.mp3');
  expect(finalFight.loop).toBe(true);
  expect(finalFight.paused).toBe(false);
  expect(fight.paused).toBe(true);
  rerender(<AudioHarness inBattle={false} finalBattle volume={50} muted={false} />);
  expect(finalFight.paused).toBe(true);
  expect(base.paused).toBe(false);
  rerender(<AudioHarness inBattle volume={50} muted={false} />);
  expect(fight.paused).toBe(false);
  expect(fight.currentTime).toBe(0);
});

it('aplica os sons de clique por página, inclui conteúdo interno e ignora botões desabilitados', () => {
  const { rerender } = render(<AudioHarness inBattle={false} volume={35} muted={false} />);
  const menu = instances.find((audio) => audio.src.includes('click-menu.wav'))!;
  const battle = instances.find((audio) => audio.src.includes('click-battle.wav'))!;
  fireEvent.click(screen.getByText('Confirmar'));
  expect(menu.play).toHaveBeenCalledTimes(1);
  expect(menu.volume).toBe(0.35);
  fireEvent.click(screen.getByText('Bloqueado'));
  expect(menu.play).toHaveBeenCalledTimes(1);
  rerender(<AudioHarness inBattle volume={35} muted={false} />);
  fireEvent.click(screen.getByText('Confirmar'));
  expect(battle.play).toHaveBeenCalledTimes(1);
  expect(menu.play).toHaveBeenCalledTimes(1);
});

it('reproduz turno, personagens derrotados e resultados com volume global e silêncio, sem loop', () => {
  const { rerender, unmount } = render(<AudioHarness inBattle volume={60} muted={false} />);
  const turn = instances.find((audio) => audio.src.includes('change-turn.wav'))!;
  const death = instances.find((audio) => audio.src.includes('player-death.wav'))!;
  const victory = instances.find((audio) => audio.src.includes('battle-win.wav'))!;
  const defeat = instances.find((audio) => audio.src.includes('battle-lose.mp3'))!;
  playSoundEffect('turn');
  playSoundEffect('defeated');
  playSoundEffect('victory');
  playSoundEffect('defeat');
  expect(turn.play).toHaveBeenCalledTimes(1);
  expect(death.play).toHaveBeenCalledTimes(1);
  expect(death.volume).toBe(0.6);
  for (const sound of [victory, defeat]) {
    expect(sound.play).toHaveBeenCalledTimes(1);
    expect(sound.volume).toBe(0.6);
    expect(sound.loop).toBe(false);
  }
  rerender(<AudioHarness inBattle volume={60} muted />);
  playSoundEffect('turn');
  playSoundEffect('defeated');
  playSoundEffect('victory');
  playSoundEffect('defeat');
  fireEvent.click(screen.getByText('Confirmar'));
  expect(turn.play).toHaveBeenCalledTimes(1);
  expect(death.play).toHaveBeenCalledTimes(1);
  expect(victory.play).toHaveBeenCalledTimes(1);
  expect(defeat.play).toHaveBeenCalledTimes(1);
  expect(instances.find((audio) => audio.src.includes('click-battle.wav'))!.play).not.toHaveBeenCalled();
  unmount();
  playSoundEffect('defeated');
  expect(death.play).toHaveBeenCalledTimes(1);
});
